import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { DEFAULT_PIECES } from "./components/helpers/Constants";
import { cloneDeep } from "./components/helpers/HelperFunctions";
import Header from "./components/Header";
import LoginModal from "./components/Login";
import Dashboard from "./components/Dashboard";
import PieceCreator from "./components/PieceCreator";
import SolverOverlay from "./components/SolvingPopup";
import StlExport from "./components/STLExport";
import axios from "axios";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";




export default function App() {

  const API_BASE = import.meta.env.VITE_API_URL;

  /* ── Auth ──────────────────────────────────────────── */
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const attrs = await fetchUserAttributes();
        const email = attrs?.email ?? attrs?.find?.(a => a.Name === "email")?.Value ?? "";
        if (email) {
          setUser({ email, initials: email.substring(0, 2).toUpperCase() });
        }
      } catch (err) {
        // no existing signed-in session
      }
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
    setUser(null);
    setLoginOpen(false);
  }, []);

  /* ── Presets & active pieces ────────────────────────── */
  const [presets, setPresets] = useState([
    { name: "Default tangram", pieces: cloneDeep(DEFAULT_PIECES), builtIn: true },
  ]);
  const [activePresetIdx, setActivePresetIdx] = useState(0);
  const [presetCounter, setPresetCounter] = useState(0);

  const pieces = useMemo(
    () => presets[activePresetIdx]?.pieces || [],
    [activePresetIdx, presets]
  );

  const setPieces = useCallback((newPieces) => {
    setPresets(prev => {
      const next = [...prev];
      next[activePresetIdx] = { ...next[activePresetIdx], pieces: cloneDeep(newPieces) };
      return next;
    });
  }, [activePresetIdx]);

  /* ── Creator form state ────────────────────────────── */
  const [selectedPieceIdx, setSelectedPieceIdx] = useState(-1);
  const [pieceName, setPieceName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [coords, setCoords] = useState([["",""],["",""],["",""]]);
  const [savedPresetSnapshot, setSavedPresetSnapshot] = useState(() =>
    JSON.stringify({ name: "Default tangram", pieces: cloneDeep(DEFAULT_PIECES), builtIn: true })
  );

  const isPresetDirty = useMemo(() => {
    if (activePresetIdx < 0) return false;
    const currentPreset = presets[activePresetIdx];
    if (!currentPreset) return false;
    return savedPresetSnapshot !== JSON.stringify(currentPreset);
  }, [activePresetIdx, presets, savedPresetSnapshot]);

  /* ── Puzzles ───────────────────────────────────────── */
  const [allPuzzles, setAllPuzzles] = useState([]);
  const puzzlesForPreset = useMemo(
    () => allPuzzles.filter(p => p.presetIdx === activePresetIdx),
    [allPuzzles, activePresetIdx]
  );

  /* ── Solver ────────────────────────────────────────── */
  const [solverOpen, setSolverOpen] = useState(false);
  const [solverPuzzle, setSolverPuzzle] = useState(null);
  const [solverComplete, setSolverComplete] = useState(false);
  const [solverFeedback, setSolverFeedback] = useState("");
  const feedbackTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  /* ── Handlers ──────────────────────────────────────── */

  const selectPiece = useCallback((idx) => {
    const newIdx = idx === selectedPieceIdx ? -1 : idx;
    setSelectedPieceIdx(newIdx);
    if (newIdx >= 0 && pieces[newIdx]) {
      setPieceName(pieces[newIdx].name);
      setCoords(pieces[newIdx].coords.map(c => [String(c[0]), String(c[1])]));
    } else {
      setPieceName("");
      setCoords([["",""],["",""],["",""]]);
    }
  }, [selectedPieceIdx, pieces]);

  const handlePieceNameChange = useCallback((val) => {
    setPieceName(val);
    if (selectedPieceIdx >= 0 && pieces[selectedPieceIdx]) {
      const np = cloneDeep(pieces);
      np[selectedPieceIdx].name = val || np[selectedPieceIdx].name;
      setPieces(np);
    }
  }, [selectedPieceIdx, pieces, setPieces]);

  const handlePresetNameChange = useCallback((val) => {
    setPresetName(val);
    if (activePresetIdx >= 0 && presets[activePresetIdx]) {
      setPresets(prev => {
        const next = [...prev];
        next[activePresetIdx] = { ...next[activePresetIdx], name: val };
        return next;
      });
    }
  }, [activePresetIdx, presets]);

  const saveCurrentPreset = useCallback(async () => {
    if (!isPresetDirty || activePresetIdx < 0) return;
    const currentPreset = presets[activePresetIdx];
    if (!currentPreset) return;

    try {
      await axios.post(`${API_BASE}/api/save-preset`, {
        preset: currentPreset,
      });
      setSavedPresetSnapshot(JSON.stringify(currentPreset));
    } catch (err) {
      console.error("Save preset failed:", err);
    }
  }, [activePresetIdx, isPresetDirty, presets, API_BASE]);

  const deletePreset = useCallback(() => {
    if (activePresetIdx < 0 || presets.length <= 1) return;
    const nextActiveIdx = Math.min(activePresetIdx, presets.length - 2);
    setPresets(prev => prev.filter((_, idx) => idx !== activePresetIdx));
    setActivePresetIdx(nextActiveIdx);
    setSelectedPieceIdx(-1);
    setPresetName(presets[nextActiveIdx]?.builtIn ? "" : presets[nextActiveIdx]?.name || "");
    setSavedPresetSnapshot(JSON.stringify(presets[nextActiveIdx] || {}));
  }, [activePresetIdx, presets]);

  const updateShape = useCallback(() => {
    const parsed = coords
      .map(([x,y]) => [parseFloat(x), parseFloat(y)])
      .filter(([x,y]) => !isNaN(x) && !isNaN(y));
    if (parsed.length < 3) return;
    const name = pieceName.trim() || `Piece ${pieces.length + 1}`;
    const np = cloneDeep(pieces);
    if (selectedPieceIdx >= 0 && np[selectedPieceIdx]) {
      np[selectedPieceIdx].name = name;
      np[selectedPieceIdx].coords = parsed;
    } else {
      np.push({ name, coords: parsed, colorIdx: np.length % 10 });
    }
    setPieces(np);
    setSelectedPieceIdx(-1);
    setPieceName("");
    setCoords([["",""],["",""],["",""]]);
  }, [coords, pieceName, pieces, selectedPieceIdx, setPieces]);

  const deletePiece = useCallback(() => {
    if (selectedPieceIdx < 0) return;
    const np = cloneDeep(pieces);
    np.splice(selectedPieceIdx, 1);
    setPieces(np);
    setSelectedPieceIdx(-1);
    setPieceName("");
    setCoords([["",""],["",""],["",""]]);
  }, [selectedPieceIdx, pieces, setPieces]);

  const duplicatePiece = useCallback(() => {
    if (selectedPieceIdx < 0) return;
    const o = pieces[selectedPieceIdx];
    const np = cloneDeep(pieces);
    np.push({ name: o.name + " copy", coords: o.coords.map(c => [c[0]+5,c[1]+5]), colorIdx: np.length % 10 });
    setPieces(np);
    setSelectedPieceIdx(np.length - 1);
  }, [selectedPieceIdx, pieces, setPieces]);

  const savePreset = useCallback(() => {
    if (!pieces.length) return;
    let name = presetName.trim();
    if (!name) {
      const c = presetCounter + 1;
      setPresetCounter(c);
      name = `Preset ${c}`;
    }
    const newPreset = { name, pieces: cloneDeep(pieces), builtIn: false };
    setPresets(prev => [...prev, newPreset]);
    const newIndex = presets.length;
    setActivePresetIdx(newIndex); // new last index
    setSavedPresetSnapshot(JSON.stringify(newPreset));
    setPresetName("");
    setSelectedPieceIdx(-1);
  }, [pieces, presetName, presetCounter, presets.length]);

  const duplicatePreset = useCallback((idx) => {
    const s = presets[idx];
    const newPreset = { name: s.name + " copy", pieces: cloneDeep(s.pieces), builtIn: false };
    setPresets(prev => [...prev, newPreset]);
    setActivePresetIdx(presets.length);
    setSavedPresetSnapshot(JSON.stringify(newPreset));
    setSelectedPieceIdx(-1);
  }, [presets]);

  const switchPreset = useCallback((idx) => {
    setActivePresetIdx(idx);
    setSelectedPieceIdx(-1);
    setPieceName("");
    setCoords([["",""],["",""],["",""]]);
    setPresetName(presets[idx]?.builtIn ? "" : presets[idx]?.name || "");
    setSavedPresetSnapshot(JSON.stringify(presets[idx] || {}));
  }, [presets]);

  const generatePuzzle = useCallback(async () => {
    const res = await axios.post(`${API_BASE}/api/generate-tangram`, 
      {
        shapes: presets[activePresetIdx].pieces,
      }
    );
    return res.data;
  }, [presets, activePresetIdx, API_BASE]);

  const createPuzzle = useCallback(async () => {
    if (!pieces.length) return;
    const result = await generatePuzzle();
    const shape = result.combined_shape || { coordinates: [] };
    const solvedShapes = result.solved_shapes || [];
    const puzzle = {
      shape,
      presetIdx: activePresetIdx,
      solvedShapes,
      num: allPuzzles.length + 1,
      id: Date.now(),
    };
    setAllPuzzles(prev => [puzzle, ...prev]);
    setSolverPuzzle(puzzle);
    setSolverComplete(false);
    setSolverFeedback("");
    setSolverOpen(true);
  }, [pieces.length, generatePuzzle, activePresetIdx, allPuzzles.length]);

  const openSolver = useCallback((puzzle) => {
    setSolverPuzzle(puzzle);
    setSolverComplete(false);
    setSolverFeedback("");
    setSolverOpen(true);
  }, []);

  const closeSolver = useCallback(() => {
    setSolverOpen(false);
  }, []);

  /* ── Check Solved: POST both SVGs to backend ─────── */
  const handleCheckSolved = useCallback(async (placedSvg, expectedSvg) => {
    try {
      const res = await axios.post(`${API_BASE}/api/check-svg`, {
        placed_svg: placedSvg,
        expected_svg: expectedSvg,
      });
      if (res.data.matches) {
        // Mark puzzle as solved if not already, updating the global puzzle list
        setAllPuzzles(prev => prev.map(p => {
          if (solverPuzzle && p.id === solverPuzzle.id) {
            const alreadySolved = p.solved === true;
            if (!alreadySolved) {
              return { ...p, solvedShapes: res.data.solved_shapes || p.solvedShapes || [], solved: true };
            }
          }
          return p;
        }));

        setSolverPuzzle(prev => (prev && solverPuzzle && prev.id === solverPuzzle.id)
          ? { ...prev, solvedShapes: res.data.solved_shapes || prev.solvedShapes || [], solved: true }
          : prev
        );

        setSolverComplete(true);
        setSolverFeedback("");
      } else {
        if (feedbackTimeoutRef.current) {
          clearTimeout(feedbackTimeoutRef.current);
        }
        setSolverFeedback("Puzzle isn't solved yet, keep trying!");
        feedbackTimeoutRef.current = setTimeout(() => {
          setSolverFeedback("");
        }, 3000);
      }
    } catch (err) {
      console.error("Check failed:", err);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      setSolverFeedback("Error checking solution. Try again.");
      feedbackTimeoutRef.current = setTimeout(() => {
        setSolverFeedback("");
      }, 3000);
    }
  }, [solverPuzzle, API_BASE]);

  const solverPieces = solverPuzzle
    ? (presets[solverPuzzle.presetIdx]?.pieces || pieces)
    : pieces;

  /* ── Render ────────────────────────────────────────── */
  return (
    <>
      {/* CSS */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />

      {/* Login Modal */}
      {loginOpen && (
        <LoginModal
          user={user}
          onClose={() => setLoginOpen(false)}
          onLogin={(u) => { setUser(u); setLoginOpen(false); }}
          onLogout={handleLogout}
        />
      )}

      {/* Solver Overlay */}
      {solverOpen && solverPuzzle && (
        <>
          <SolverOverlay
            puzzle={solverPuzzle}
            pieces={solverPieces}
            solvedShapes={solverPuzzle.solvedShapes || []}
            isComplete={solverComplete}
            onCheckSolved={handleCheckSolved}
            feedbackMessage={solverFeedback}
            onClose={closeSolver}
          />
        </>
      )}

      {/* Header */}
      <Header
        presets={presets}
        activePresetIdx={activePresetIdx}
        onSwitchPreset={switchPreset}
        user={user}
        onLoginClick={() => setLoginOpen(true)}
      />

      {/* Main Content */}
      <main>
        {/* Dashboard */}
        <Dashboard
          pieces={pieces}
          presetName={presets[activePresetIdx]?.name || ""}
          puzzlesForPreset={puzzlesForPreset}
          hasAnyPuzzles={allPuzzles.length > 0}
          onGenerate={createPuzzle}
          onOpenSolver={openSolver}
        />

        <hr className="divider" />

        {/* Piece Creator */}
        <PieceCreator
          pieces={pieces}
          selectedPieceIdx={selectedPieceIdx}
          pieceName={pieceName}
          presetName={presetName}
          coords={coords}
          presets={presets}
          activePresetIdx={activePresetIdx}
          isPresetDirty={isPresetDirty}
          onSelectPiece={selectPiece}
          onPieceNameChange={handlePieceNameChange}
          onPresetNameChange={handlePresetNameChange}
          onCoordsChange={setCoords}
          onAddVertex={() => setCoords(c => [...c, ["",""]])}
          onUpdateShape={updateShape}
          onDeletePiece={deletePiece}
          onDuplicatePiece={duplicatePiece}
          onSavePreset={savePreset}
          onSaveCurrentPreset={saveCurrentPreset}
          onDeletePreset={deletePreset}
          onDuplicatePreset={duplicatePreset}
          onSwitchPreset={switchPreset}
        />

        <hr className="divider" />

        {/* STL Export */}
        <StlExport pieces={pieces} />
      </main>
    </>
  );
}