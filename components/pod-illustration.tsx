export function PodIllustration() {
  return <div className="pod-art" aria-hidden="true"><svg viewBox="0 0 700 480" fill="none">
    <defs><linearGradient id="pod-body" x1="180" y1="160" x2="410" y2="330" gradientUnits="userSpaceOnUse"><stop stopColor="#777" /><stop offset=".35" stopColor="#292c2d" /><stop offset=".7" stopColor="#0f1112" /><stop offset="1" stopColor="#444" /></linearGradient><linearGradient id="rail"><stop stopColor="#bf5700" stopOpacity="0" /><stop offset=".5" stopColor="#bf5700" /><stop offset="1" stopColor="#bf5700" stopOpacity=".1" /></linearGradient></defs>
    <g stroke="#ffffff" strokeOpacity=".065">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 100 - 200} 480 700 ${120 + i * 42}`} />)}{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M0 ${140 + i * 42} ${i * 110} 480`} />)}</g>
    <ellipse cx="363" cy="257" rx="271" ry="154" stroke="#bf5700" strokeOpacity=".2" strokeDasharray="4 8" transform="rotate(-22 363 257)" />
    <path d="M0 444 693 167M0 467 700 184" stroke="url(#rail)" strokeWidth="3" />
    <path d="m139 345 358-145 79 36-357 146z" fill="#121313" stroke="#545454" />
    <path d="m196 336 279-111 29 13-277 112z" fill="#bf5700" />
    <path d="m205 323 12-36 255-104 51 31-7 25-267 108z" fill="#181a1b" stroke="#565858" />
    <path d="M175 300c-14-16-5-41 13-55l214-119c29-16 63-10 87 13l49 46c14 14 8 30-10 38L257 331c-29 10-63-8-82-31Z" fill="url(#pod-body)" stroke="#7b7b76" />
    <path d="m192 247 236-111c19-8 34-6 45 4l-227 115c-18 8-40 5-54-8Z" fill="#9a9b94" fillOpacity=".55" />
    <path d="m241 269 245-118 25 25-243 110z" fill="#090b0c" stroke="#575b5c" />
    <path d="m178 294 78 30 271-109" stroke="#e36a20" strokeWidth="3" />
    <path d="m303 185 40 29 25 72M383 141l42 34 30 75" stroke="#999" strokeOpacity=".35" />
    <path d="m334 250 61-26" stroke="white" strokeWidth="3" /><path d="m334 257 35-15" stroke="white" strokeOpacity=".4" />
    <g stroke="#bf5700" strokeOpacity=".65"><path d="M452 145V70h110M225 334v71H115" /><circle cx="452" cy="145" r="4" fill="#bf5700" /><circle cx="225" cy="334" r="4" fill="#bf5700" /></g>
    <g fill="#999" fontFamily="monospace" fontSize="9" letterSpacing="2"><text x="470" y="59">ENGINEER THE FUTURE</text><text x="85" y="425">CONCEPT / HYPERLOOP</text></g>
  </svg></div>;
}
