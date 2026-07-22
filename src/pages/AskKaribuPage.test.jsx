// Client half of FIX_PLAN P0 #5 (send a sessionId so ai_conversations logging is
// not dead code; trim history to the server's cap) + the #1 review follow-up
// (the trimmed window must begin with a user turn — Anthropic rejects an
// assistant-first array).
//
// We mock the Supabase client at the functions.invoke level to capture exactly
// what the page sends, and drive real send cycles through the UI.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CityProvider } from "../context/CityContext.jsx";
import { ReferenceDataProvider } from "../context/ReferenceDataContext.jsx";
import AskKaribuPage from "./AskKaribuPage.jsx";

const { invokeCalls } = vi.hoisted(() => ({ invokeCalls: { list: [] } }));

vi.mock("../lib/supabase", () => {
  const empty = Promise.resolve({ data: null, error: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (f) => empty.then(f),
  };
  return {
    supabase: {
      from: () => chain,
      functions: {
        invoke: (name, opts) => {
          invokeCalls.list.push({ name, body: opts?.body });
          const n = invokeCalls.list.length;
          return Promise.resolve({
            data: { content: [{ type: "text", text: `reply-${n}` }] },
            error: null,
          });
        },
      },
    },
  };
});

function mountAsk() {
  return render(
    <ReferenceDataProvider>
      <CityProvider>
        <MemoryRouter>
          <AskKaribuPage />
        </MemoryRouter>
      </CityProvider>
    </ReferenceDataProvider>,
  );
}

beforeEach(() => {
  invokeCalls.list = [];
});

test("sends a non-empty sessionId (so ai_conversations logging is live)", async () => {
  const user = userEvent.setup();
  mountAsk();

  await user.type(
    screen.getByPlaceholderText(/Ask about anything/i),
    "where can I eat near JKIA?{Enter}",
  );

  await waitFor(() => expect(invokeCalls.list.length).toBe(1));
  const { name, body } = invokeCalls.list[0];
  expect(name).toBe("ask-karibu");
  expect(typeof body.sessionId).toBe("string");
  expect(body.sessionId.length).toBeGreaterThan(0);
  expect(body.city).toBe("nairobi");
  expect(body.messages[0].role).toBe("user");
});

test("caps sent history at the 20-turn server limit and always starts on a user turn", async () => {
  const user = userEvent.setup();
  mountAsk();
  const textarea = screen.getByPlaceholderText(/Ask about anything/i);

  // 11 user turns -> the 11th send has a 21-message history (u1,a1,...,u10,a10,u11);
  // slice(-20) would start on an assistant turn, which the fix must correct.
  for (let k = 1; k <= 11; k++) {
    await user.type(textarea, `question ${k}{Enter}`);
    await screen.findByText(`reply-${k}`); // assistant reply appended before next send
  }

  const last = invokeCalls.list[invokeCalls.list.length - 1].body.messages;
  expect(last.length).toBeLessThanOrEqual(20);
  expect(last[0].role).toBe("user"); // never assistant-first
});
