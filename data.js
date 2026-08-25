const STORAGE_KEY = "diapason_guitars";

const PALETTE = [
  { name: "Sunburst", hex: "#A8432E" },
  { name: "Negro azabache", hex: "#1C1C1C" },
  { name: "Natural", hex: "#C89B5C" },
  { name: "Verde surf", hex: "#3F6B5C" },
  { name: "Blanco perla", hex: "#E9E2D0" },
  { name: "Azul océano", hex: "#2E5C8A" },
];

const SEED_GUITARS = [
  {
    id: "1",
    name: "Criolla del Sur",
    type: "Acústica",
    price: 185000,
    condition: "Usada - Excelente",
    color: "#C89B5C",
    description:
      "Guitarra criolla de tapa maciza de cedro, ideal para folklore y zamba. Encordado nuevo, sin golpes ni fisuras. Mástil recto, muy cómoda para principiantes y avanzados.",
    seller: "Marisa T.",
    active: true,
  },
  {
    id: "2",
    name: "Halcón Eléctrica",
    type: "Eléctrica",
    price: 410000,
    condition: "Nueva",
    color: "#A8432E",
    description:
      "Doble cutaway, dos humbuckers de alta salida, mástil de arce con diapasón de palo rosa. Viene con funda acolchada y cable de 3 metros.",
    seller: "Guitarras Rioja",
    active: true,
  },
  {
    id: "3",
    name: "Trueno Bajo",
    type: "Bajo",
    price: 320000,
    condition: "Usada - Buena",
    color: "#1C1C1C",
    description:
      "Bajo de 4 cuerdas, cuerpo de fresno, pastillas activas. Algunas marcas de uso normal en la parte trasera, no afectan el sonido ni la afinación.",
    seller: "Nico G.",
    active: true,
  },
  {
    id: "4",
    name: "Paloma Blanca",
    type: "Acústica",
    price: 145000,
    condition: "Para restaurar",
    color: "#E9E2D0",
    description:
      "Necesita ajuste de mástil y encordado nuevo. Cuerpo en buen estado general. Buena base para un proyecto de restauración o para aprender a lutear.",
    seller: "Marisa T.",
    active: true,
  },
  {
    id: "5",
    name: "Costa Azul",
    type: "Eléctrica",
    price: 275000,
    condition: "Usada - Excelente",
    color: "#2E5C8A",
    description:
      "Single coils, tremolo funcional en perfecto estado, muy poco uso. Suena brillante y es ideal para blues y rock clásico.",
    seller: "Guitarras Rioja",
    active: true,
  },
  {
    id: "6",
    name: "Sauce Verde",
    type: "Acústica",
    price: 198000,
    condition: "Nueva",
    color: "#3F6B5C",
    description:
      "Cuerpo dreadnought, tapa de abeto macizo, aros y fondo de caoba. Sonido cálido con buena proyección, ideal para grabación.",
    seller: "Nico G.",
    active: true,
  },
];

function loadGuitars() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_GUITARS));
    return [...SEED_GUITARS];
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_GUITARS));
    return [...SEED_GUITARS];
  }
}

function saveGuitars(guitars) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guitars));
}

function money(n) {
  return "$ " + Number(n).toLocaleString("es-AR");
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
