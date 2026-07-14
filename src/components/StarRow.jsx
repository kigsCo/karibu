import { Star } from "lucide-react";

const StarRow = ({ rating, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={i <= Math.round(rating) ? "fill-current" : ""}
        style={{ color: i <= Math.round(rating) ? "#D4A341" : "#D7CFC4" }}
      />
    ))}
  </span>
);

export default StarRow;
