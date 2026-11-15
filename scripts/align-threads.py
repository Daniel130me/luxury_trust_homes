#!/usr/bin/env python3
"""Align the thread-message markup in the client, staff and provider
case pages to the prototype: avatar chip beside each bubble, own
messages right-aligned in brand-800, other party in brand-50, name
header and text-2xs timestamp. Also drops card section headings to the
prototype's text-base size."""
from pathlib import Path

ROOT = Path("/home/z/my-project/src/app/app")

CLIENT = ROOT / "client/enquiries/[id]/page.tsx"
STAFF = ROOT / "staff/matters/[enquiryId]/page.tsx"
PROVIDER = ROOT / "provider/cases/[id]/page.tsx"


def bubble(is_self: str, label_expr: str, extra_time: str = "") -> str:
    """Render the prototype thread bubble for one message.

    is_self: boolean expression for "message written by the viewer's side".
    label_expr: expression appended after the name for the other party.
    extra_time: extra fragment inside the timestamp line (e.g. INTERNAL).
    """
    return f"""              return (
                <div key={{message.id}} className={{`flex gap-3 ${{{is_self} ? "flex-row-reverse" : ""}}`}}>
                  <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xs font-semibold text-white">
                    {{message.author.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}}
                  </span>
                  <div className={{`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${{{is_self} ? "bg-brand-800 text-white" : "bg-brand-50"}}`}}>
                    <p className={{`mb-0.5 text-xs font-semibold ${{{is_self} ? "text-brand-100" : "text-brand-700"}}`}}>
                      {{message.author.name}}
                      {{{label_expr}}}
                    </p>
                    <p className="whitespace-pre-line">{{message.body}}</p>
                    <p className={{`mt-1 text-2xs ${{{is_self} ? "text-brand-200" : "text-ink-muted"}}`}}>
                      {extra_time}{{formatDateTime(message.at)}}
                    </p>
                  </div>
                </div>
              );"""


def swap(path: Path, old_map: str, new_map: str) -> None:
    text = path.read_text()
    if old_map not in text:
        # Already swapped on a previous run — safe to skip.
        print(f"skip (pattern absent): {path}")
        return
    path.write_text(text.replace(old_map, new_map))
    print(f"updated {path.name}")


# 1. Client view — lawyer writes on the left, client on the right.
swap(
    CLIENT,
    """              return (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                    fromLawyer
                      ? "bg-white text-ink-strong border border-brand-100"
                      : "ml-auto bg-brand-800 text-white"
                  }`}
                >
                  <p className="whitespace-pre-line">{message.body}</p>
                  <p className={`mt-1 text-[10px] ${fromLawyer ? "text-ink-muted" : "text-white/70"}`}>
                    {message.author.name}
                    {fromLawyer ? " · ELVICTORIA Legal" : ""} · {formatDateTime(message.at)}
                  </p>
                </div>
              );""",
    bubble(
        "!fromLawyer",
        'fromLawyer && <span className="font-normal opacity-80"> · ELVICTORIA Legal</span>',
    ),
)

# 2. Staff view — staff writes on the right; client/provider on the left.
swap(
    STAFF,
    """                return (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                      fromStaff
                        ? "bg-brand-800 text-white"
                        : "bg-white text-ink-strong border border-brand-100"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.body}</p>
                    <p className={`mt-1 text-[10px] ${fromStaff ? "text-white/70" : "text-ink-muted"}`}>
                      {message.author.name}
                      {fromStaff ? " · ELVICTORIA Legal" : ""}
                      {activeThread === "INTERNAL" ? " · INTERNAL" : ""} · {formatDateTime(message.at)}
                    </p>
                  </div>
                );""",
    bubble(
        "fromStaff",
        '!fromStaff && <span className="font-normal opacity-80">{activeThread === "INTERNAL" ? " · Internal note" : " · ELVICTORIA Legal"}</span>',
    ).replace("              return (", "                return (").replace(
        "                <div key={message.id}", "                  <div key={message.id}"
    ),
)

# 3. Provider view — provider on the right, lawyer on the left.
swap(
    PROVIDER,
    """            return (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  fromLawyer
                    ? "bg-white text-ink-strong border border-brand-100"
                    : "ml-auto bg-brand-800 text-white"
                }`}
              >
                <p className="whitespace-pre-line">{message.body}</p>
                <p className={`mt-1 text-[10px] ${fromLawyer ? "text-ink-muted" : "text-white/70"}`}>
                  {message.author.name}
                  {fromLawyer ? " · ELVICTORIA Legal" : ""} · {formatDateTime(message.at)}
                </p>
              </div>
            );""",
    bubble(
        "!fromLawyer",
        'fromLawyer && <span className="font-normal opacity-80"> · ELVICTORIA Legal</span>',
    ).replace("              return (", "            return (").replace(
        "                <div key={message.id}", "              <div key={message.id}"
    ),
)

# Section headings inside cards: text-base semibold (prototype).
for path, needle in [
    (CLIENT, '<h2 className="text-lg font-semibold text-ink-strong">Messages with the ELVICTORIA legal team</h2>'),
    (STAFF, '<h2 className="text-lg font-semibold text-ink-strong">'),
    (PROVIDER, '<h2 className="text-lg font-semibold text-ink-strong">'),
]:
    t = path.read_text()
    t = t.replace(needle, needle.replace("text-lg", "text-base"))
    path.write_text(t)

print("headings adjusted")
