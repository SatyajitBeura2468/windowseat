export function icon(
  name: "menu" | "shuffle" | "sound" | "mute" | "focus" | "photo" | "spark" | "close" | "layers" | "glass" | "lamp"
) {
  const paths: Record<typeof name, string> = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    shuffle:
      '<path d="M16 3h5v5"/><path d="M4 17.5c4 0 5.5-11 12-11h5"/><path d="M16 21h5v-5"/><path d="M4 6.5c2.2 0 3.8 1.3 5.2 3.1"/><path d="M13.2 14.4c1.4 1.8 3 3.1 5.8 3.1h2"/>',
    sound:
      '<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9c.8.8 1.2 1.8 1.2 3s-.4 2.2-1.2 3"/><path d="M18.5 6.5A7.8 7.8 0 0 1 21 12a7.8 7.8 0 0 1-2.5 5.5"/>',
    mute: '<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="m18 9-5 6"/><path d="m13 9 5 6"/>',
    focus:
      '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
    photo:
      '<path d="M4 7a2 2 0 0 1 2-2h2l1.5-2h5L16 5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"/><circle cx="12" cy="12" r="3.5"/>',
    spark: '<path d="M12 2v6"/><path d="M12 16v6"/><path d="M2 12h6"/><path d="M16 12h6"/><path d="m4.9 4.9 4.2 4.2"/><path d="m14.9 14.9 4.2 4.2"/><path d="m19.1 4.9-4.2 4.2"/><path d="m9.1 14.9-4.2 4.2"/>',
    close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    glass: '<path d="M7 3h10l-2 18H9L7 3z"/><path d="M9 7h6"/><path d="M9.5 12h5"/>',
    lamp: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</g></svg>`;
}
