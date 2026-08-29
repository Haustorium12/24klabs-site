// SHELF THEMES — implements specs/DOOR_THEMES_v0.1.md against the 13 shelves that exist.
//
// Sean commissioned this: "each major category can be themed to itself… go overboard with
// the decoration cause we can always scale back." The spec was written deliberately
// overbuilt, to be cut down. This is the cut, and the spec named the order to make it in.
//
// THE ONE STRUCTURAL RULE: THEME THE HEADER, NEVER THE ROW.
// Everything here lives in a shelf's heading, glyph, accent and standing line. The rows
// are identical on all thirteen — same height, same type size, same date gutter, same grid.
// Two reasons, neither of them restraint:
//   1. Craigslist packing only holds if every block obeys one grid. A shelf that changes
//      row height breaks the brickwork for every block beside it.
//   2. A themed header is one row in this file. A themed row is 500 entries by hand.
//
// WHAT THE SPEC SAID NEVER TO CUT, and so all thirteen have all three:
//   glyph · accent on the heading rule · standing line
// Those alone carry the entire orientation benefit — someone landing three levels deep
// from a search result knows which wing they are in before reading the breadcrumb.
//
// WHAT IS CUT, in the spec's own order: all animation, all textures (scanlines, brick,
// CRT, noise), all alternate typefaces, all per-shelf background tints. They cost bytes
// and add nothing at this density. Anything that survived is static and made of data we
// already hold.
//
// AND THE GOLD NEVER CHANGES. --gold #D4AF37 carries links and headings on every shelf;
// each adds ONE supporting accent. Gold is what tells a visitor they are still on
// 24klabs.ai after everything else has changed.

export const SHELF_THEMES = {
  // --- 01 · APIs & Services — the specification sheet -----------------------
  apis: {
    accent: '#7c6df0',
    register: 'a specification sheet',
    standing:
      'Endpoints that do a job and charge for it. The largest shelf, and the one where ' +
      '"it answered when we knocked" carries the most weight — an API that does not respond ' +
      'is not a product, it is a URL.',
    // a lens / aperture: what a spec sheet describes
    glyph: '<circle cx="8" cy="8" r="6.2"/><circle cx="8" cy="8" r="2.4"/><path d="M8 1.8v3M8 11.2v3M1.8 8h3M11.2 8h3"/>',
  },

  // --- 02 · MCP Servers — the node graph ------------------------------------
  'mcp-servers': {
    accent: '#4ecdc4',
    register: 'an architecture diagram',
    standing:
      'Model Context Protocol servers — the sockets an agent plugs into. These are the one ' +
      'shelf where a GET is the wrong knock: JSON-RPC answers POST and 405s everything else. ' +
      'We probe them the way a client would.',
    glyph: '<circle cx="3" cy="4" r="1.7"/><circle cx="13" cy="4" r="1.7"/><circle cx="8" cy="12.5" r="1.7"/><path d="M4.4 5.1 6.9 11M11.6 5.1 9.1 11M4.7 4h6.6"/>',
  },

  // --- 03 · Ecosystem — the survey sheet ------------------------------------
  ecosystem: {
    accent: '#c9a227',
    register: 'an ordnance map margin',
    standing:
      'The wider terrain — the projects, initiatives and bodies that make x402 a place ' +
      'rather than a protocol. Listed because they exist and matter, not because they sell ' +
      'anything.',
    glyph: '<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c2.6 2.6 2.6 9.8 0 12.4M8 1.8c-2.6 2.6-2.6 9.8 0 12.4"/>',
  },

  // --- 04 · SDKs & Libraries — the workbench --------------------------------
  sdks: {
    accent: '#8fbf6a',
    register: 'a README that respects you',
    standing:
      'Code you import rather than call. Most of this shelf has no endpoint to knock, so the ' +
      'stamp means the repository answered — public, resolving, alive. Being honest about the ' +
      'difference is the point.',
    glyph: '<path d="M5.6 4 1.8 8l3.8 4M10.4 4l3.8 4-3.8 4M9.3 2.6 6.7 13.4"/>',
    mono: true, // spec: BUILD's mono is load-bearing and survives the cut
  },

  // --- 05 · Learning Resources — the primer ---------------------------------
  learning: {
    accent: '#d9c9a3',
    register: 'a textbook frontispiece',
    standing:
      'Guides, courses, walkthroughs and explainers. The shelf most likely to rot quietly: a ' +
      'tutorial can stay online for years after the thing it teaches has changed underneath it. ' +
      'A green knock here proves the page loads, nothing more.',
    glyph: '<path d="M8 3.6C6.4 2.5 4 2.4 1.9 3v9c2.1-.6 4.5-.5 6.1.6M8 3.6c1.6-1.1 4-1.2 6.1-.6v9c-2.1-.6-4.5-.5-6.1.6M8 3.6v9.6"/>',
    serif: true, // spec: the only shelf besides the graveyard where a serif appears
  },

  // --- 06 · Tools & Utilities — the workbench -------------------------------
  tools: {
    accent: '#8fbf6a',
    register: 'a workbench',
    standing:
      'Small sharp things that do one job. Scanners, converters, inspectors, CLIs. The shelf ' +
      'with the shortest half-life, because a weekend tool is the easiest thing in the world ' +
      'to stop paying for.',
    glyph: '<path d="M10.4 2.2a3.6 3.6 0 0 0-4.6 4.6l-4 4a1.4 1.4 0 0 0 2 2l4-4a3.6 3.6 0 0 0 4.6-4.6L10 6.4 8.9 5.3z"/>',
    mono: true,
  },

  // --- 07 · Security — the audit terminal -----------------------------------
  security: {
    accent: '#4ecdc4',
    register: 'a terminal running a scan someone will sign their name to',
    standing:
      'Scanners, auditors, verifiers, risk feeds. The coldest shelf on the site, and the one ' +
      'where our own standard has to be highest: a security tool that cannot be reached is ' +
      'worse than no security tool, because someone is relying on it.',
    // a plumb line / assay stamp, not a padlock — the spec was explicit
    glyph: '<path d="M8 1.6v7.2M4.4 8.8h7.2l-3.6 5.6z"/><circle cx="8" cy="1.6" r="1"/>',
    doubleRule: true, // ruled off the way a signed report is
    statusStrip: true, // pass / fail / unprobed, from real knock receipts
  },

  // --- 08 · Facilitators — the ticker ---------------------------------------
  facilitators: {
    accent: '#f4d03f',
    register: 'a market page from before markets got designed',
    standing:
      'The parties that actually settle a payment. The smallest shelf carrying the largest ' +
      'systemic risk — a USENIX audit of fifteen major facilitators serving 119M transactions ' +
      'found security-rule violations in every one.',
    glyph: '<path d="M8 2.4v11.2M3 4.6h10M4.2 4.6 2 9.2h4.4zM11.8 4.6 9.6 9.2H14z"/>',
  },

  // --- 09 · Global Agent Economy — the departures board ---------------------
  global: {
    accent: '#c9a227',
    register: 'an airport departures board',
    standing:
      'x402 beyond one chain and one region. Multi-chain rails, regional programmes, ' +
      'cross-border settlement. Seven-plus chains and eighteen tracked facilitators as of the ' +
      'last industry read.',
    glyph: '<circle cx="8" cy="8" r="6.2"/><path d="M8 1.8v12.4M2.4 5.2h11.2M2.4 10.8h11.2"/>',
  },

  // --- 10 · Frameworks & Middleware — the rack elevation --------------------
  frameworks: {
    accent: '#7f9c93',
    register: 'a datacentre elevation drawing',
    standing:
      'The layer between an application and the protocol — middleware, adapters, server ' +
      'scaffolding. Since AWS and Cloudflare made charging for an endpoint a console toggle, ' +
      'this shelf competes with a checkbox.',
    glyph: '<rect x="2" y="2.6" width="12" height="3.4" rx="0.4"/><rect x="2" y="10" width="12" height="3.4" rx="0.4"/><path d="M4 4.3h.01M4 11.7h.01"/>',
  },

  // --- 11 · Community — the notice board ------------------------------------
  community: {
    accent: '#e0a3a3',
    register: 'a parish notice board',
    standing:
      'Where people talk rather than where machines transact. Forums, chats, hubs, and the ' +
      'places a question gets answered by a human. Nothing here charges anything.',
    glyph: '<circle cx="8" cy="4" r="2.2"/><path d="M8 6.4v6M8 12.4l-2.6 1.6M8 12.4l2.6 1.6"/>',
  },

  // --- 12 · Market Data — the feed rack -------------------------------------
  'market-data': {
    accent: '#f4d03f',
    register: 'a wire service rack',
    standing:
      'Prices, volumes, indices, on-chain reads. The shelf where the freshness stamp matters ' +
      'most and means least — a feed can answer instantly and still be serving numbers from ' +
      'last week. A knock cannot see that.',
    glyph: '<path d="M2 12.6 5.6 8l2.8 2.6L14 3.4M14 3.4h-3.6M14 3.4v3.6"/>',
  },

  // --- 13 · Aggregators & Proxies — the card catalogue ----------------------
  aggregators: {
    accent: '#ddd9c9',
    register: 'a library catalogue drawer',
    standing:
      'The other directories and routers — the ones that do what we do, or route around it. ' +
      'We list our competitors because a map that omits the other maps is not a map. Their ' +
      'scale is not our scale and pretending otherwise would be checkable.',
    glyph: '<rect x="2" y="3" width="12" height="10" rx="0.5"/><path d="M2 6.4h12M2 9.7h12M6.6 3v10"/>',
  },
};

export const DEFAULT_THEME = {
  accent: 'var(--gold-dim)',
  register: 'a reference shelf',
  standing: 'Curated entries, each one live-knocked before it was listed.',
  glyph: '<rect x="2.4" y="2.4" width="11.2" height="11.2" rx="0.6"/><path d="M2.4 6.2h11.2"/>',
};

export function themeFor(key) {
  return { ...DEFAULT_THEME, ...(SHELF_THEMES[key] || {}) };
}
