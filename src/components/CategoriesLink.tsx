import { Link, useLocation } from "react-router-dom";

export function scrollToCategories() {
  document.getElementById("market-categories")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

export function CategoriesLink() {
  const location = useLocation();
  return (
    <Link
      to="/#categories"
      className="shop-categories-link"
      onClick={(event) => {
        if (
          location.pathname === "/" &&
          document.getElementById("market-categories")
        ) {
          event.preventDefault();
          scrollToCategories();
        }
      }}
    >
      Категории <span aria-hidden="true">↓</span>
    </Link>
  );
}
