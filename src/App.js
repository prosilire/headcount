// Headcount app

import { useState, useEffect, useRef } from "react";
import JSZip from "jszip";

// ── helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

const STORAGE_KEY = "headcount_v1";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// Default placeholder data — triggers welcome modal
const DEFAULT_HOUSEHOLDS = [
  {
    id: uid(), name: "Household 1", order: 0,
    members: [
      { id: uid(), firstName: "Person 1", photo: null, attending: false },
      { id: uid(), firstName: "Person 2", photo: null, attending: false },
    ]
  },
  {
    id: uid(), name: "Household 2", order: 1,
    members: [
      { id: uid(), firstName: "Person 3", photo: null, attending: false },
    ]
  },
];

const PLACEHOLDER_HOUSEHOLD_NAMES = ["Household 1", "Household 2"];

function isDefaultRoster(households) {
  if (households.length === 0) return true;
  const totalMembers = households.reduce((s, hh) => s + hh.members.length, 0);
  if (totalMembers === 0) return true;
  // Check if all household names match placeholder pattern
  const allPlaceholder = households.every(hh =>
    PLACEHOLDER_HOUSEHOLD_NAMES.includes(hh.name) ||
    /^Household \d+$/i.test(hh.name)
  );
  return allPlaceholder;
}

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const ACCENT_COLORS = ["#C0714A", "#6B8F71", "#7B6EA6", "#5E8AAD", "#B5785A", "#4A7C8A"];
function accentFor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return ACCENT_COLORS[Math.abs(h) % ACCENT_COLORS.length];
}

// ── ZIP export / import ───────────────────────────────────────────────────────
async function exportZip(households) {
  const zip = new JSZip();
  const roster = households.map(hh => ({
    ...hh,
    members: hh.members.map(p => ({ ...p, photo: p.photo ? `photos/${p.id}.jpg` : null }))
  }));
  zip.file("roster.json", JSON.stringify(roster, null, 2));
  const photos = zip.folder("photos");
  for (const hh of households) {
    for (const p of hh.members) {
      if (p.photo) {
        const b64 = p.photo.split(",")[1];
        if (b64) photos.file(`${p.id}.jpg`, b64, { base64: true });
      }
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "Headcount.zip";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

async function importZip(file) {
  const zip = await JSZip.loadAsync(file);
  const rosterFile = zip.file("roster.json");
  if (!rosterFile) { alert("Invalid Headcount ZIP."); return null; }
  const roster = JSON.parse(await rosterFile.async("string"));
  for (const hh of roster) {
    for (const p of hh.members) {
      if (p.photo && p.photo.startsWith("photos/")) {
        const photoFile = zip.file(p.photo);
        if (photoFile) {
          const b64 = await photoFile.async("base64");
          p.photo = `data:image/jpeg;base64,${b64}`;
        } else { p.photo = null; }
      }
      p.attending = false;
    }
  }
  return roster;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ person, size = 64, attending }) {
  const color = accentFor(person.firstName);
  const style = {
    width: size, height: size, borderRadius: "50%",
    overflow: "hidden", flexShrink: 0,
    border: attending ? `3px solid ${color}` : "3px solid transparent",
    transition: "border-color 0.2s, opacity 0.2s",
    opacity: attending ? 1 : 0.38,
    background: color,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.32, fontWeight: 700, color: "#fff",
    userSelect: "none",
  };
  return (
    <div style={style}>
      {person.photo
        ? <img src={person.photo} alt={person.firstName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials(person.firstName)}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, noCloseOnOverlay }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(40,28,20,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      padding: 16,
    }} onClick={e => { if (!noCloseOnOverlay && e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "#FDF7F0", borderRadius: 20, padding: "24px 24px 20px",
        width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {title && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#2C1A0E" }}>{title}</span>
            {onClose && (
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#8B6A55", lineHeight: 1 }}>×</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ModalBtn({ onClick, children, danger, secondary, fullWidth }) {
  return (
    <button onClick={onClick} style={{
      padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer",
      fontWeight: 700, fontSize: 15, flex: fullWidth ? undefined : 1,
      width: fullWidth ? "100%" : undefined,
      background: secondary ? "#EDE0D4" : "#C0714A",
      color: secondary ? "#7A5840" : "#fff",
      transition: "opacity 0.15s",
      fontFamily: "inherit",
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = 0.85}
      onMouseLeave={e => e.currentTarget.style.opacity = 1}>
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, autoFocus }) {
  return (
    <input
      autoFocus={autoFocus}
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "11px 14px", borderRadius: 12,
        border: "1.5px solid #D9C9B8", background: "#FFF9F4",
        fontSize: 15, color: "#2C1A0E", outline: "none", boxSizing: "border-box",
        marginBottom: 14, fontFamily: "inherit",
      }}
    />
  );
}

// ── Welcome Modal ─────────────────────────────────────────────────────────────
function WelcomeModal({ onImport, onDismiss }) {
  const importRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const imported = await importZip(file);
    if (imported) onImport(imported);
    e.target.value = "";
  }

  return (
    <Modal noCloseOnOverlay>
      <div style={{ textAlign: "center", paddingBottom: 4 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#2C1A0E", marginBottom: 8 }}>
          Welcome to Headcount
        </h2>
        <p style={{ fontSize: 14, color: "#7A5840", lineHeight: 1.65, marginBottom: 20 }}>
          The easy way to know how many are coming to dinner.
          Add your family's households and people, or import a
          roster someone already set up.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <ModalBtn fullWidth onClick={() => importRef.current.click()}>
            ⬆ Import a Headcount.zip
          </ModalBtn>
          <input ref={importRef} type="file" accept=".zip" style={{ display: "none" }} onChange={handleFile} />
          <ModalBtn fullWidth secondary onClick={onDismiss}>
            Set up from scratch
          </ModalBtn>
        </div>

        <p style={{ fontSize: 12, color: "#A08878", lineHeight: 1.5 }}>
          You can always import or export a roster later from the main screen.
        </p>
      </div>
    </Modal>
  );
}

// ── Person Modal ──────────────────────────────────────────────────────────────
function PersonModal({ person, onSave, onClose, onDelete }) {
  const [firstName, setFirstName] = useState(person ? person.firstName : "");
  const [photo, setPhoto] = useState(person ? person.photo : null);
  const fileRef = useRef();

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <Modal title={person ? "Edit person" : "Add person"} onClose={onClose}>
      <TextInput value={firstName} onChange={setFirstName} placeholder="First name" autoFocus />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", overflow: "hidden",
          background: accentFor(firstName || "?"), flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, color: "#fff",
        }}>
          {photo
            ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initials(firstName || "?")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => fileRef.current.click()} style={{
            padding: "8px 16px", borderRadius: 10, border: "1.5px solid #C0714A",
            background: "none", color: "#C0714A", fontWeight: 600, fontSize: 14,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {photo ? "Change photo" : "Add photo"}
          </button>
          {photo && (
            <button onClick={() => setPhoto(null)} style={{
              padding: "8px 16px", borderRadius: 10, border: "1.5px solid #D9C9B8",
              background: "none", color: "#8B6A55", fontWeight: 600, fontSize: 14,
              cursor: "pointer", fontFamily: "inherit",
            }}>Remove photo</button>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
      <div style={{ display: "flex", gap: 10 }}>
        <ModalBtn secondary onClick={onClose}>Cancel</ModalBtn>
        <ModalBtn onClick={() => { if (firstName.trim()) onSave({ firstName: firstName.trim(), photo }); }}>Save</ModalBtn>
      </div>
      {person && (
        <button onClick={onDelete} style={{
          marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 12,
          border: "1.5px solid #D9C9B8", background: "none",
          color: "#b05030", fontWeight: 600, fontSize: 14, cursor: "pointer",
          fontFamily: "inherit",
        }}>Delete person</button>
      )}
    </Modal>
  );
}

// ── Household Modal ───────────────────────────────────────────────────────────
function HouseholdModal({ household, onSave, onClose, onDelete }) {
  const [name, setName] = useState(household ? household.name : "");
  return (
    <Modal title={household ? "Rename household" : "Add household"} onClose={onClose}>
      <TextInput value={name} onChange={setName} placeholder="Household name" autoFocus />
      <div style={{ display: "flex", gap: 10 }}>
        <ModalBtn secondary onClick={onClose}>Cancel</ModalBtn>
        <ModalBtn onClick={() => { if (name.trim()) onSave(name.trim()); }}>Save</ModalBtn>
      </div>
      {household && (
        <button onClick={onDelete} style={{
          marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 12,
          border: "1.5px solid #D9C9B8", background: "none",
          color: "#b05030", fontWeight: 600, fontSize: 14, cursor: "pointer",
          fontFamily: "inherit",
        }}>Delete household & all members</button>
      )}
    </Modal>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <Modal title="Are you sure?" onClose={onClose}>
      <p style={{ color: "#5A3E2B", fontSize: 15, marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <ModalBtn secondary onClick={onClose}>Cancel</ModalBtn>
        <ModalBtn danger onClick={onConfirm}>Confirm</ModalBtn>
      </div>
    </Modal>
  );
}

// ── PersonTile ────────────────────────────────────────────────────────────────
function PersonTile({ person, onToggle, onEdit, dragHandlers }) {
  return (
    <div
      draggable
      onDragStart={dragHandlers.onDragStart}
      onDragEnter={dragHandlers.onDragEnter}
      onDragEnd={dragHandlers.onDragEnd}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        cursor: "pointer", padding: "8px 4px", borderRadius: 14,
        transition: "background 0.15s",
        position: "relative",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#EDE0D4"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      onClick={onToggle}
    >
      <Avatar person={person} size={64} attending={person.attending} />
      <span style={{
        fontSize: 12, fontWeight: 600, color: person.attending ? "#2C1A0E" : "#A08878",
        textAlign: "center", maxWidth: 72, overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.2s",
      }}>{person.firstName}</span>
      <button
        onClick={e => { e.stopPropagation(); onEdit(); }}
        style={{
          position: "absolute", top: 2, right: 2,
          background: "rgba(255,255,255,0.85)", border: "none", borderRadius: "50%",
          width: 20, height: 20, fontSize: 11, cursor: "pointer",
          color: "#8B6A55", display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}
        title="Edit"
      >✎</button>
    </div>
  );
}

// ── HouseholdBlock ────────────────────────────────────────────────────────────
function HouseholdBlock({ household, onToggleAll, onTogglePerson, onEditHousehold, onAddPerson, onEditPerson, hhDrag }) {
  const members = household.members;
  const attendingCount = members.filter(p => p.attending).length;
  const allIn = attendingCount === members.length && members.length > 0;
  const someIn = attendingCount > 0 && !allIn;
  const color = accentFor(household.name);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  return (
    <div style={{
      background: "#FDF7F0", borderRadius: 20,
      border: "1.5px solid #E8D9C8", marginBottom: 14,
      overflow: "hidden",
    }}>
      {/* Household header */}
      <div
        draggable
        onDragStart={() => hhDrag.onDragStart()}
        onDragEnter={() => hhDrag.onDragEnter()}
        onDragEnd={() => hhDrag.onDragEnd()}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", cursor: "pointer",
          borderBottom: members.length ? "1px solid #EDE0D4" : "none",
          userSelect: "none",
        }}
        onClick={onToggleAll}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 4,
            background: allIn ? color : "transparent",
            border: `2.5px solid ${allIn ? color : someIn ? color : "#C4B0A0"}`,
            flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {someIn && !allIn && (
              <div style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
            )}
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#2C1A0E" }}>{household.name}</span>
          {attendingCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: color + "22", color: color,
            }}>{attendingCount}/{members.length}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
          <button onClick={onAddPerson} style={{
            padding: "5px 12px", borderRadius: 10, border: `1.5px solid ${color}`,
            background: "none", color, fontWeight: 700, fontSize: 12, cursor: "pointer",
            fontFamily: "inherit",
          }}>+ Add</button>
          <button onClick={onEditHousehold} style={{
            padding: "5px 10px", borderRadius: 10, border: "1.5px solid #D9C9B8",
            background: "none", color: "#8B6A55", fontWeight: 700, fontSize: 12, cursor: "pointer",
            fontFamily: "inherit",
          }}>⋯</button>
        </div>
      </div>

      {/* Members grid */}
      {members.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
          gap: 4, padding: "12px 12px 8px",
        }}>
          {members.map((person, i) => (
            <PersonTile
              key={person.id}
              person={person}
              onToggle={() => onTogglePerson(person.id)}
              onEdit={() => onEditPerson(person)}
              dragHandlers={{
                onDragStart: () => { dragIdx.current = i; },
                onDragEnter: () => { dragOverIdx.current = i; },
                onDragEnd: () => {
                  if (dragIdx.current !== null && dragOverIdx.current !== null && dragIdx.current !== dragOverIdx.current) {
                    const next = [...members];
                    const [moved] = next.splice(dragIdx.current, 1);
                    next.splice(dragOverIdx.current, 0, moved);
                    onTogglePerson(null, next);
                  }
                  dragIdx.current = null; dragOverIdx.current = null;
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Install Banner ────────────────────────────────────────────────────────────
const BANNER_DISMISSED_KEY = "headcount_banner_dismissed";

function useShowInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(BANNER_DISMISSED_KEY)) return;
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) return;
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setShow(false);
  }

  return [show, dismiss];
}

function InstallBanner({ onDismiss }) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "#2C1A0E", padding: "14px 16px 20px",
      display: "flex", alignItems: "flex-start", gap: 12,
      boxShadow: "0 -4px 24px rgba(0,0,0,0.25)",
      animation: "slideUp 0.3s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>🍽️</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#F5EDE1", margin: "0 0 4px", fontFamily: "inherit" }}>
          Add Headcount to your Home Screen
        </p>
        <p style={{ fontSize: 12, color: "#C4A882", margin: 0, lineHeight: 1.5, fontFamily: "inherit" }}>
          {isIOS
            ? <>Tap the share icon <strong style={{ color: "#F5EDE1" }}>⎙</strong> then <strong style={{ color: "#F5EDE1" }}>"Add to Home Screen"</strong></>
            : <>Tap your browser menu and choose <strong style={{ color: "#F5EDE1" }}>"Add to Home Screen"</strong></>
          }
        </p>
      </div>
      <button onClick={onDismiss} style={{
        background: "none", border: "none", color: "#8B6A55",
        fontSize: 22, cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: 0,
      }}>×</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [households, setHouseholds] = useState(() => load() || DEFAULT_HOUSEHOLDS);
  const [modal, setModal] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBanner, dismissBanner] = useShowInstallBanner();
  const importRef = useRef();

  // persist on every change
  useEffect(() => { save(households); }, [households]);

  // show welcome modal if roster is still default/empty
  useEffect(() => {
    if (isDefaultRoster(households)) {
      setShowWelcome(true);
    }
  }, []); // only on mount

  const totalAttending = households.reduce((sum, hh) =>
    sum + hh.members.filter(p => p.attending).length, 0);

  // ── mutations ─────────────────────────────────────────────────────────────
  function toggleAll(hhId) {
    setHouseholds(prev => prev.map(hh => {
      if (hh.id !== hhId) return hh;
      const allIn = hh.members.every(p => p.attending);
      return { ...hh, members: hh.members.map(p => ({ ...p, attending: !allIn })) };
    }));
  }

  function togglePerson(hhId, personId, reorderedMembers) {
    setHouseholds(prev => prev.map(hh => {
      if (hh.id !== hhId) return hh;
      if (reorderedMembers) return { ...hh, members: reorderedMembers };
      return { ...hh, members: hh.members.map(p => p.id === personId ? { ...p, attending: !p.attending } : p) };
    }));
  }

  function saveHousehold(name, hhId) {
    if (hhId) {
      setHouseholds(prev => prev.map(hh => hh.id === hhId ? { ...hh, name } : hh));
    } else {
      setHouseholds(prev => [...prev, { id: uid(), name, order: prev.length, members: [] }]);
    }
    setModal(null);
  }

  function deleteHousehold(hhId) {
    setHouseholds(prev => prev.filter(hh => hh.id !== hhId));
    setModal(null);
  }

  function savePerson(hhId, personId, data) {
    setHouseholds(prev => prev.map(hh => {
      if (hh.id !== hhId) return hh;
      if (personId) {
        return { ...hh, members: hh.members.map(p => p.id === personId ? { ...p, ...data } : p) };
      } else {
        return { ...hh, members: [...hh.members, { id: uid(), attending: false, ...data }] };
      }
    }));
    setModal(null);
  }

  function deletePerson(hhId, personId) {
    setHouseholds(prev => prev.map(hh =>
      hh.id !== hhId ? hh : { ...hh, members: hh.members.filter(p => p.id !== personId) }
    ));
    setModal(null);
  }

  function globalAddAll() {
    setHouseholds(prev => prev.map(hh => ({ ...hh, members: hh.members.map(p => ({ ...p, attending: true })) })));
  }

  function globalClearAll() {
    setHouseholds(prev => prev.map(hh => ({ ...hh, members: hh.members.map(p => ({ ...p, attending: false })) })));
    setModal(null);
  }

  // household drag
  const hhDragIdx = useRef(null);
  const hhDragOverIdx = useRef(null);

  function reorderHouseholds() {
    if (hhDragIdx.current === null || hhDragOverIdx.current === null || hhDragIdx.current === hhDragOverIdx.current) return;
    setHouseholds(prev => {
      const next = [...prev];
      const [moved] = next.splice(hhDragIdx.current, 1);
      next.splice(hhDragOverIdx.current, 0, moved);
      return next.map((hh, i) => ({ ...hh, order: i }));
    });
    hhDragIdx.current = null; hhDragOverIdx.current = null;
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const imported = await importZip(file);
    if (imported) {
      setModal({ type: "importChoice", imported });
    }
    e.target.value = "";
  }

  function handleWelcomeImport(imported) {
    setHouseholds(imported);
    setShowWelcome(false);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#F5EDE1",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      {/* Welcome modal */}
      {showWelcome && (
        <WelcomeModal
          onImport={handleWelcomeImport}
          onDismiss={() => setShowWelcome(false)}
        />
      )}

      {/* Install nudge banner */}
      {showBanner && !showWelcome && (
        <InstallBanner onDismiss={dismissBanner} />
      )}

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#2C1A0E", padding: "0 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#F5EDE1", lineHeight: 1 }}>
            {totalAttending}
          </span>
          <span style={{ fontSize: 14, color: "#C4A882", fontStyle: "italic" }}>coming to dinner</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={globalAddAll} style={{
            padding: "7px 14px", borderRadius: 20, border: "1.5px solid #C4A882",
            background: "none", color: "#C4A882", fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}>All in</button>
          <button onClick={() => setModal({ type: "clearConfirm" })} style={{
            padding: "7px 14px", borderRadius: 20, border: "1.5px solid #8B6A55",
            background: "none", color: "#8B6A55", fontSize: 13, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}>Clear</button>
        </div>
      </div>

      {/* Households */}
      <div style={{ padding: "16px 16px 100px" }}>
        {households.map((hh, i) => (
          <HouseholdBlock
            key={hh.id}
            household={hh}
            onToggleAll={() => toggleAll(hh.id)}
            onTogglePerson={(personId, reordered) => togglePerson(hh.id, personId, reordered)}
            onEditHousehold={() => setModal({ type: "household", household: hh })}
            onAddPerson={() => setModal({ type: "person", hhId: hh.id, person: null })}
            onEditPerson={(p) => setModal({ type: "person", hhId: hh.id, person: p })}
            hhDrag={{
              onDragStart: () => { hhDragIdx.current = i; },
              onDragEnter: () => { hhDragOverIdx.current = i; },
              onDragEnd: reorderHouseholds,
            }}
          />
        ))}

        {/* Bottom actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => setModal({ type: "household", household: null })} style={{
            flex: 1, padding: "13px 0", borderRadius: 14,
            border: "2px dashed #C4B0A0", background: "none",
            color: "#8B6A55", fontWeight: 700, fontSize: 15, cursor: "pointer",
            fontFamily: "inherit",
          }}>+ Add household</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={() => exportZip(households)} style={{
            flex: 1, padding: "11px 0", borderRadius: 14,
            border: "1.5px solid #C4B0A0", background: "none",
            color: "#7A5840", fontWeight: 600, fontSize: 14, cursor: "pointer",
            fontFamily: "inherit",
          }}>⬇ Export ZIP</button>
          <button onClick={() => importRef.current.click()} style={{
            flex: 1, padding: "11px 0", borderRadius: 14,
            border: "1.5px solid #C4B0A0", background: "none",
            color: "#7A5840", fontWeight: 600, fontSize: 14, cursor: "pointer",
            fontFamily: "inherit",
          }}>⬆ Import ZIP</button>
        </div>
        <input ref={importRef} type="file" accept=".zip" style={{ display: "none" }} onChange={handleImport} />
      </div>

      {/* Modals */}
      {modal?.type === "clearConfirm" && (
        <ConfirmModal
          message="This will remove everyone from the headcount. Your roster stays intact."
          onConfirm={globalClearAll}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "household" && (
        <HouseholdModal
          household={modal.household}
          onSave={(name) => saveHousehold(name, modal.household?.id)}
          onClose={() => setModal(null)}
          onDelete={() => setModal({ type: "deleteHouseholdConfirm", hhId: modal.household.id })}
        />
      )}

      {modal?.type === "deleteHouseholdConfirm" && (
        <ConfirmModal
          message="This will permanently delete the household and all its members."
          onConfirm={() => deleteHousehold(modal.hhId)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "person" && (
        <PersonModal
          person={modal.person}
          onSave={(data) => savePerson(modal.hhId, modal.person?.id, data)}
          onClose={() => setModal(null)}
          onDelete={() => setModal({ type: "deletePersonConfirm", hhId: modal.hhId, personId: modal.person.id })}
        />
      )}

      {modal?.type === "deletePersonConfirm" && (
        <ConfirmModal
          message="Permanently delete this person from the roster?"
          onConfirm={() => deletePerson(modal.hhId, modal.personId)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "importChoice" && (
        <Modal title="Import roster" onClose={() => setModal(null)}>
          <p style={{ color: "#5A3E2B", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            How would you like to import this roster?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ModalBtn fullWidth onClick={() => {
              setHouseholds(modal.imported);
              setModal(null);
            }}>Replace my roster</ModalBtn>
            <ModalBtn fullWidth secondary onClick={() => {
              setHouseholds(prev => {
                const existingIds = new Set(prev.flatMap(hh => hh.members.map(p => p.id)));
                const merged = [...prev];
                for (const importedHH of modal.imported) {
                  const existing = merged.find(hh => hh.name === importedHH.name);
                  if (existing) {
                    const newMembers = importedHH.members.filter(p => !existingIds.has(p.id));
                    existing.members = [...existing.members, ...newMembers];
                  } else {
                    merged.push({ ...importedHH, order: merged.length });
                  }
                }
                return merged;
              });
              setModal(null);
            }}>Merge with mine</ModalBtn>
            <button onClick={() => setModal(null)} style={{
              padding: "10px 0", background: "none", border: "none",
              color: "#8B6A55", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
            }}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
