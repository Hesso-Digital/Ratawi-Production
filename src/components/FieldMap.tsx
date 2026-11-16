import {
  AG25,
  CONCESSION_ISO,
  CPF,
  EXPORT_LINE,
  SPP_ISO,
  U,
  VIEWBOX,
  WELLS,
  box,
  parentOf,
  pathFrom,
  pathFromPlan,
  prismFaces,
  project,
  projectPlan,
  pts,
  shade,
  toPlan,
  type Well,
} from '../data/field';

function Prism({
  footprint,
  h,
  base,
  edge,
  z0 = 0,
}: {
  footprint: [number, number][];
  h: number;
  base: string;
  edge: string;
  z0?: number;
}) {
  const { walls, roof } = prismFaces(footprint, h, z0);
  return (
    <g>
      {walls.map((w, i) => (
        <polygon
          key={i}
          points={pts(w.q)}
          fill={shade(base, w.lum)}
          stroke={edge}
          strokeWidth={0.5 * U}
        />
      ))}
      <polygon points={pts(roof)} fill={shade(base, 1.25)} stroke={edge} strokeWidth={0.6 * U} />
    </g>
  );
}

function Pin({
  at,
  num,
  name,
  color,
  width,
  dx,
  lift,
}: {
  at: { x: number; y: number };
  num: string;
  name: string;
  color: string;
  width: number;
  dx: number;
  lift: number;
}) {
  const h = 28 * U;
  const Wd = width * U;
  const cx = at.x + dx * U;
  const top = at.y - lift * U - h;
  return (
    <g>
      <line
        x1={at.x}
        y1={at.y}
        x2={cx}
        y2={at.y - lift * U}
        stroke={color}
        strokeWidth={1.2 * U}
      />
      <circle cx={at.x} cy={at.y} r={3 * U} fill={color} />
      <rect
        x={cx - Wd / 2}
        y={top}
        width={Wd}
        height={h}
        rx={10 * U}
        fill="rgba(8,14,22,0.86)"
        stroke={color}
        strokeWidth={1.3 * U}
      />
      <circle cx={cx - Wd / 2 + 16 * U} cy={top + 14 * U} r={9 * U} fill={color} />
      <text
        x={cx - Wd / 2 + 16 * U}
        y={top + 18 * U}
        textAnchor="middle"
        fontSize={11 * U}
        fontWeight={700}
        fill="#06111c"
      >
        {num}
      </text>
      <text
        x={cx - Wd / 2 + 31 * U}
        y={top + 18.5 * U}
        fontSize={12.5 * U}
        fill="#e8eef2"
        fontWeight={600}
      >
        {name}
      </text>
    </g>
  );
}

function Facility() {
  const c = toPlan(...CPF);
  const a = toPlan(...AG25);
  return (
    <g>
      <ellipse
        cx={projectPlan(...c).x}
        cy={projectPlan(...c).y + 8 * U}
        rx={78 * U}
        ry={30 * U}
        fill="#000"
        opacity={0.45}
      />
      <Prism footprint={box(c[0] - 150, c[1] - 105, 300, 210)} h={16} base="#1d3f52" edge="#4f8ea6" />
      <Prism footprint={box(c[0] - 126, c[1] - 82, 112, 74)} h={88} base="#2b5870" edge="#7cc3da" />
      <Prism footprint={box(c[0] + 10, c[1] - 84, 112, 58)} h={60} base="#2b5870" edge="#7cc3da" />
      <Prism footprint={box(c[0] - 124, c[1] + 14, 74, 64)} h={120} base="#356a85" edge="#8fd6ec" />
      <Prism footprint={box(c[0] - 24, c[1] + 12, 144, 70)} h={72} base="#2b5870" edge="#7cc3da" />
      <ellipse
        cx={projectPlan(...a).x}
        cy={projectPlan(...a).y + 6 * U}
        rx={58 * U}
        ry={22 * U}
        fill="#000"
        opacity={0.45}
      />
      <Prism
        footprint={[
          [a[0] - 125, a[1] + 72],
          [a[0] + 112, a[1] - 16],
          [a[0] + 32, a[1] - 112],
        ]}
        h={60}
        base="#141a22"
        edge="#8d7bd0"
      />
      <Pin at={projectPlan(c[0] - 80, c[1] + 40, 120)} num="1" name="CPF-1" color="#43d2de" width={118} dx={-95} lift={80} />
      <Pin at={projectPlan(a[0] + 20, a[1] - 40, 70)} num="2" name="AG-25" color="#b08cff" width={118} dx={70} lift={48} />
    </g>
  );
}

function WellMark({ well, live }: { well: Well; live: boolean }) {
  const q = project(well.x, well.y);
  const agup = well.kind === 'agup';
  const r = agup ? 5.6 * U : 4.2 * U;
  const fill = !agup ? '#2be7ff' : live ? '#f5d07a' : '#0e1820';
  const stroke = !agup ? '#c0f8ff' : live ? '#ffe0a0' : '#f59e0b';
  return (
    <g>
      {agup ? (
        <circle
          cx={q.x}
          cy={q.y}
          r={11 * U}
          fill="none"
          stroke={live ? '#f5d07a' : '#f59e0b'}
          strokeOpacity={live ? 0.55 : 0.35}
          strokeWidth={1.2 * U}
        />
      ) : null}
      {agup && !live ? (
        <rect
          x={q.x - r}
          y={q.y - r}
          width={r * 2}
          height={r * 2}
          transform={`rotate(45 ${q.x} ${q.y})`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.6 * U}
        />
      ) : (
        <circle cx={q.x} cy={q.y} r={r} fill={fill} stroke={stroke} strokeWidth={1.4 * U} />
      )}
    </g>
  );
}

export function FieldMap({
  wellsOnline,
  gas,
}: {
  wellsOnline: number;
  gas: number;
}) {
  const agupLive = wellsOnline >= 31.5;
  const gasLive = gas >= 5;
  const online = WELLS.filter((w) => w.kind === 'online');
  const agup = WELLS.filter((w) => w.kind === 'agup');
  const flowPool = agupLive ? WELLS : online;

  const grid: string[] = [];
  for (let v = -2600; v <= 5200; v += 260) {
    grid.push(pathFromPlan([
      [v, -2600],
      [v, 5200],
    ]));
    grid.push(pathFromPlan([
      [-2600, v],
      [5200, v],
    ]));
  }

  const sppPanels: string[] = [];
  for (let x = 1012; x <= 1512; x += 24) {
    sppPanels.push(
      pathFromPlan([
        [x, 683],
        [x, x > 1225 && x < 1345 ? 915 : 826],
      ]),
    );
  }

  const nameA = projectPlan(-250, 900);
  const nameB = projectPlan(-250, 1700);
  const nameAng = (Math.atan2(nameB.y - nameA.y, nameB.x - nameA.x) * 180) / Math.PI;

  const exportTip = project(...EXPORT_LINE[EXPORT_LINE.length - 1]);
  const exportPrev = project(...EXPORT_LINE[EXPORT_LINE.length - 2]);
  const exportAng = (Math.atan2(exportTip.y - exportPrev.y, exportTip.x - exportPrev.x) * 180) / Math.PI;

  const sppPin = projectPlan(1500, 560);
  const exportPin = project(...EXPORT_LINE[3]);

  return (
    <section className="panel map-panel" data-entrance>
      <div className="map-heading">
        <div className="eyebrow">Ratawi concession</div>
        <div className="meta">Isometric schematic  ·  25 online  ·  7 AGUP  ·  CPF-1  ·  AG-25</div>
      </div>
      <svg
        className="field-svg"
        viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
        role="img"
        aria-label="Ratawi field isometric schematic"
      >
        <defs>
          <linearGradient id="concg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1a3748" />
            <stop offset="0.55" stopColor="#122a3a" />
            <stop offset="1" stopColor="#0d2030" />
          </linearGradient>
          <clipPath id="sppClip">
            <polygon points={pts(SPP_ISO)} />
          </clipPath>
          <filter id="lglow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={2.2 * U} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g opacity={0.28}>
          {grid.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(90,140,160,0.22)" strokeWidth={0.6 * U} />
          ))}
        </g>
        <polygon points={pts(CONCESSION_ISO)} fill="url(#concg)" opacity={0.92} />
        <polygon
          points={pts(CONCESSION_ISO)}
          fill="none"
          stroke="#ff5a4a"
          strokeOpacity={0.22}
          strokeWidth={14 * U}
          filter="url(#lglow)"
        />
        <polygon
          points={pts(CONCESSION_ISO)}
          fill="none"
          stroke="#ff6a5a"
          strokeWidth={2.4 * U}
          filter="url(#lglow)"
        />
        <polygon points={pts(SPP_ISO)} fill="rgba(80,140,220,0.08)" />
        <g clipPath="url(#sppClip)">
          {sppPanels.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(91,156,245,0.35)" strokeWidth={3.2 * U} />
          ))}
        </g>
        <polygon
          points={pts(SPP_ISO)}
          fill="none"
          stroke="#5b9cf5"
          strokeWidth={2.2 * U}
          strokeDasharray={`${9 * U} ${5 * U}`}
        />

        {online.map((w) => (
          <path
            key={`flow-${w.name}`}
            className="flow-line"
            d={pathFrom([[w.x, w.y], parentOf(w, online)])}
            fill="none"
            stroke="#2be7ff"
            strokeWidth={1.8 * U}
            strokeDasharray={`${4 * U} ${14 * U}`}
            opacity={0.85}
          />
        ))}
        {agup.map((w) => (
          <path
            key={`agup-flow-${w.name}`}
            className={agupLive ? 'flow-line agup' : undefined}
            d={pathFrom([[w.x, w.y], parentOf(w, flowPool)])}
            fill="none"
            stroke={agupLive ? '#f5d07a' : 'rgba(245,158,11,0.25)'}
            strokeWidth={1.8 * U}
            strokeDasharray={`${4 * U} ${14 * U}`}
            opacity={agupLive ? 0.95 : 0.35}
          />
        ))}

        <path d={pathFrom(EXPORT_LINE)} fill="none" stroke="rgba(127,227,196,0.2)" strokeWidth={9 * U} />
        <path
          className="flow-line export"
          d={pathFrom(EXPORT_LINE)}
          fill="none"
          stroke="#7fe3c4"
          strokeWidth={4 * U}
          strokeDasharray={`${8 * U} ${18 * U}`}
        />
        <path
          d={`M${-7 * U} ${-7 * U}L${8 * U} 0L${-7 * U} ${7 * U}Z`}
          fill="#7fe3c4"
          transform={`translate(${exportTip.x + 8 * U} ${exportTip.y}) rotate(${exportAng.toFixed(1)})`}
        />

        <path
          d={pathFrom([CPF, AG25])}
          fill="none"
          stroke={gasLive ? 'rgba(176,140,255,0.3)' : 'rgba(176,140,255,0.1)'}
          strokeWidth={7 * U}
        />
        <path
          className={gasLive ? 'flow-line gas' : undefined}
          d={pathFrom([CPF, AG25])}
          fill="none"
          stroke={gasLive ? '#b08cff' : 'rgba(176,140,255,0.25)'}
          strokeWidth={3.2 * U}
          strokeDasharray={`${6 * U} ${16 * U}`}
          opacity={gasLive ? 1 : 0.35}
        />

        {WELLS.map((w) => (
          <WellMark key={w.name} well={w} live={w.kind === 'online' || agupLive} />
        ))}

        <Facility />
        <Pin at={sppPin} num="4" name="SPP" color="#5b9cf5" width={80} dx={120} lift={-10} />
        <Pin at={exportPin} num="3" name="EXPORT" color="#7fe3c4" width={100} dx={90} lift={30} />
        <text
          x={nameA.x}
          y={nameA.y}
          transform={`rotate(${nameAng.toFixed(1)} ${nameA.x} ${nameA.y})`}
          fontSize={11 * U}
          fontWeight={700}
          letterSpacing="0.3em"
          fill="#ff8a80"
          opacity={0.55}
        >
          RATAWI CONCESSION
        </text>
      </svg>
      <div className="map-legend">
        <span className="legend-item">
          <i style={{ background: '#2be7ff', boxShadow: '0 0 8px #2be7ff' }} />
          Online wells
        </span>
        <span className="legend-item">
          <i style={{ background: agupLive ? '#f5d07a' : '#0e1820', border: '1px solid #f59e0b' }} />
          AGUP wells
        </span>
        <span className="legend-item">
          <i style={{ background: '#5b9cf5', borderRadius: 2 }} />
          SPP
        </span>
        <span className="legend-item">
          <i style={{ background: '#7fe3c4' }} />
          Export
        </span>
        <span className="legend-item">
          <i style={{ background: gasLive ? '#b08cff' : '#3a3050' }} />
          Gas to AG-25
        </span>
      </div>
    </section>
  );
}
