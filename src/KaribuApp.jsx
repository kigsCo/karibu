import React, { useState } from "react";
import {
  Heart, ChevronRight, ChevronLeft, Star,
  Phone, MessageCircle, Navigation, Globe, Clock, Check,
  Sparkles,
  Banknote,
  Trophy, Camera, X, ThumbsUp, AlertCircle,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { useBusinessDetail } from "./hooks/useBusinessDetail.js";
import Badge from "./components/Badge.jsx";
import StarRow from "./components/StarRow.jsx";
import HeroImage from "./components/HeroImage.jsx";
// KAR-6: `recommended` + `salonsList` are the byte-identical prototype
// literals; other screens use them as the fallback value passed into
// data hooks, and these screens fall back to them directly.
import { recommended, salonsList } from "./data/businesses.js";
import { reviewsSample } from "./data/reviews.js";

