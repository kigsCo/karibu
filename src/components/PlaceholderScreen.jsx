import { Bookmark } from "lucide-react";

const PlaceholderScreen = ({ title, message }) => (
  <div className="fade-in flex flex-col items-center justify-center h-full text-center px-8 py-20">
    <div className="w-14 h-14 rounded-full bg-ivory-2 flex items-center justify-center mb-4">
      <Bookmark size={22} className="text-clay" />
    </div>
    <h2 className="font-serif-d text-2xl text-ink mb-1">{title}</h2>
    <p className="text-sm text-stone-w max-w-xs">{message}</p>
  </div>
);

export default PlaceholderScreen;
