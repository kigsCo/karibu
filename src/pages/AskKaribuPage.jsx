import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, AlertCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useReferenceData } from "../context/ReferenceDataContext.jsx";
import { useLegacyNav } from "../lib/nav.js";
import { useCity } from "../context/CityContext.jsx";

// ---------- SCREEN: ASK KARIBU (AI search) ----------
const AskKaribuScreen = ({ back, go, activeCity }) => {
  const { cities } = useReferenceData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const cityLabel = cities.find((c) => c.key === activeCity)?.label || "Nairobi";

  const examplePrompts = [
    `I have 3 hours before my flight — where should I eat near JKIA?`,
    `First time in ${cityLabel}, need a trusted salon for gel nails`,
    `Pharmacy open past 10pm tonight`,
    `Romantic dinner under KSh 5,000 per person`,
  ];

  const sendMessage = async (promptText) => {
    const userMsg = { role: "user", content: promptText };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);
    setError(null);

    try {
      // The Anthropic key never touches the browser. We call the ask-karibu
      // edge function, which holds the Anthropic API key server-side, grounds
      // the reply in the live verified directory, and returns the raw Anthropic
      // Messages response — so the content parsing below is unchanged.
      const { data, error: fnError } = await supabase.functions.invoke(
        "ask-karibu",
        {
          body: {
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
            city: activeCity,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || "Ask Karibu request failed");
      }

      const text = data?.content
        ?.map((i) => (i.type === "text" ? i.text : ""))
        .filter(Boolean)
        .join("\n") || "I'm not sure how to help with that just yet.";

      setMessages([...nextMessages, { role: "assistant", content: text }]);
    } catch (e) {
      setError(e.message || "Something went wrong reaching Karibu AI.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
  };

  return (
    <div className="fade-in flex flex-col h-full">
      {/* Top bar */}
      <div className="px-5 md:px-8 pt-4 pb-3 flex items-center justify-between border-b border-ink-10">
        <button
          onClick={back}
          className="w-8 h-8 rounded-full border border-ink-10 flex items-center justify-center"
        >
          <ChevronLeft size={17} className="text-ink" />
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-ochre flex items-center justify-center">
            <Sparkles size={12} className="text-white" />
          </div>
          <h2 className="font-serif-d text-lg text-ink">Ask Karibu</h2>
        </div>
        <button
          onClick={() => setMessages([])}
          className="text-xs text-stone-w font-medium"
          style={{ opacity: messages.length > 0 ? 1 : 0 }}
        >
          Clear
        </button>
      </div>

      {/* Messages / empty state */}
      <div className="flex-1 overflow-y-auto hide-scroll px-5 md:px-8 py-4">
        {messages.length === 0 ? (
          <div className="fade-in">
            <div className="text-center py-4 mb-4">
              <div className="inline-flex w-12 h-12 rounded-full bg-ochre-soft items-center justify-center mb-3">
                <Sparkles size={20} className="text-ochre-d" />
              </div>
              <h3 className="font-serif-d text-2xl text-ink leading-tight">
                Your local AI guide
              </h3>
              <p className="text-xs text-stone-w mt-1 leading-relaxed px-4">
                Ask anything about services in {cityLabel}. I only recommend verified Karibu businesses.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] md:text-xs font-semibold text-stone-w uppercase tracking-wider mb-1">
                Try asking
              </div>
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="w-full text-left p-3 rounded-xl bg-ivory-2 border border-ink-10 text-sm text-ink active:bg-ivory"
                >
                  <span className="italic text-stone-w">"</span>{p}<span className="italic text-stone-w">"</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`fade-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-ink text-white rounded-br-sm"
                      : "bg-ochre-soft text-ink border border-ochre rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1 mb-1.5">
                      <Sparkles size={10} className="text-ochre-d" />
                      <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-ochre-d">
                        Karibu AI
                      </span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex justify-start fade-in">
                <div className="bg-ochre-soft border border-ochre rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                  <Loader2 size={13} className="text-ochre-d animate-spin" />
                  <span className="text-xs text-ochre-d">Thinking...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-xl bg-clay-soft border border-clay text-xs text-ink">
                <div className="flex items-start gap-2">
                  <AlertCircle size={13} className="text-clay flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">Couldn't reach Karibu AI</div>
                    <div className="text-stone-w">{error}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-ink-10 bg-ivory">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end bg-white border border-ink-10 rounded-2xl px-3 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Ask about anything in ${cityLabel}...`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-ink font-sans-d outline-none resize-none leading-snug max-h-24"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition ${
              input.trim() && !isStreaming ? "bg-clay" : "bg-ivory-2"
            }`}
          >
            <Send
              size={16}
              className={input.trim() && !isStreaming ? "text-white" : "text-stone-w"}
            />
          </button>
        </div>
        <p className="text-[10px] md:text-xs text-stone-w text-center mt-1.5 leading-tight">
          Karibu AI only recommends verified businesses · Can make mistakes
        </p>
      </div>
    </div>
  );
};

export default function AskKaribuPage() {
  const navigate = useNavigate();
  const { go } = useLegacyNav();
  const { cityKey } = useCity();
  return <AskKaribuScreen back={() => navigate(-1)} go={go} activeCity={cityKey} />;
}
