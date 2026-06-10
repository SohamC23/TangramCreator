export const COLORS = [
  { fill: "#C8B6FF", stroke: "#6C5CE7" },
  { fill: "#A78BFA", stroke: "#6C5CE7" },
  { fill: "#6EE7B7", stroke: "#059669" },
  { fill: "#FCA5A5", stroke: "#DC2626" },
  { fill: "#FCD34D", stroke: "#D97706" },
  { fill: "#93C5FD", stroke: "#2563EB" },
  { fill: "#F9A8D4", stroke: "#DB2777" },
  { fill: "#C0DD97", stroke: "#3B6D11" },
  { fill: "#F7C1C1", stroke: "#A32D2D" },
  { fill: "#FDE68A", stroke: "#92400E" },
];

export const DEFAULT_PIECES = [
  { name: "Large tri A", coords: [[50,0],[50,50],[100,0]], colorIdx: 0 },
  { name: "Large tri B", coords: [[75,50],[125,50],[125,0]], colorIdx: 1 },
  { name: "Medium tri", coords: [[75,75],[100,100],[125,75]], colorIdx: 2 },
  { name: "Small tri A", coords: [[0,0],[0,25],[25,0]], colorIdx: 3 },
  { name: "Small tri B", coords: [[0,50],[25,25],[25,50]], colorIdx: 4 },
  { name: "Square", coords: [[0,75],[0,100],[25,100],[25,75]], colorIdx: 5 },
  { name: "Parallelogram", coords: [[50,75],[50,100],[75,125],[75,100]], colorIdx: 6 },
];
