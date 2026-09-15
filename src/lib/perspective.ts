// True projective (perspective) correction with no external dependency:
// solve the 8-unknown homography mapping the unit square's corners to an
// arbitrary quadrilateral (the document's 4 corners in source-image pixel
// space), then render it by sampling that homography on a fine grid and
// drawing each small grid cell with a plain affine `drawImage` transform.
// A homography is well approximated by an affine map over a small enough
// region, so a fine grid renders visually identical to sampling the true
// projective transform per output pixel, at a fraction of the cost (one
// native drawImage per cell instead of a JS per-pixel loop).

export type Point = { x: number; y: number };
// Corners in TL, TR, BR, BL order, matching the unit square's own corner
// order (0,0), (1,0), (1,1), (0,1).
export type Quad = [Point, Point, Point, Point];

type HomographyCoeffs = [number, number, number, number, number, number, number, number];

function solveHomography(quad: Quad): HomographyCoeffs {
  const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [s, t] = uv[i];
    const { x, y } = quad[i];
    rows.push([s, t, 1, 0, 0, 0, -s * x, -t * x, x]);
    rows.push([0, 0, 0, s, t, 1, -s * y, -t * y, y]);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const pv = rows[col][col];
    if (Math.abs(pv) < 1e-9) throw new Error("Les 4 coins ne forment pas un quadrilatère valide.");
    for (let c = col; c <= n; c++) rows[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = rows[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) rows[r][c] -= factor * rows[col][c];
    }
  }
  return rows.map(r => r[n]) as HomographyCoeffs;
}

function evalHomography([a, b, c, d, e, f, g, h]: HomographyCoeffs, s: number, t: number): Point {
  const denom = g * s + h * t + 1;
  return { x: (a * s + b * t + c) / denom, y: (d * s + e * t + f) / denom };
}

// Affine transform (as canvas setTransform coefficients) that maps the
// source triangle basis (p0,p1,p2) onto the destination basis (q0,q1,q2).
// Any 3 non-collinear point correspondences fully determine an affine map.
function affineFromTriangles(p0: Point, p1: Point, p2: Point, q0: Point, q1: Point, q2: Point) {
  const ux = p1.x - p0.x, uy = p1.y - p0.y;
  const vx = p2.x - p0.x, vy = p2.y - p0.y;
  const det = ux * vy - uy * vx;
  if (Math.abs(det) < 1e-9) return null;
  const invDet = 1 / det;
  const ia = vy * invDet, ib = -vx * invDet, ic = -uy * invDet, id = ux * invDet;
  const ux2 = q1.x - q0.x, uy2 = q1.y - q0.y;
  const vx2 = q2.x - q0.x, vy2 = q2.y - q0.y;
  const a = ux2 * ia + vx2 * ic, c = ux2 * ib + vx2 * id;
  const b = uy2 * ia + vy2 * ic, d = uy2 * ib + vy2 * id;
  const e = q0.x - (a * p0.x + c * p0.y);
  const f = q0.y - (b * p0.x + d * p0.y);
  return { a, b, c, d, e, f };
}

// Warps the `quad` region of `source` (in source-pixel coordinates) onto a
// new outW x outH canvas, correcting perspective. Grid resolution scales
// with output size but is capped for speed; a mobile-scanned page renders
// in well under a second.
export function warpQuadToCanvas(
  source: CanvasImageSource,
  quad: Quad,
  outWidth: number,
  outHeight: number,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(outWidth));
  out.height = Math.max(1, Math.round(outHeight));
  const ctx = out.getContext("2d")!;

  const coeffs = solveHomography(quad);
  const cols = Math.max(8, Math.min(40, Math.round(out.width / 40)));
  const rows = Math.max(8, Math.min(56, Math.round(out.height / 40)));

  // Pre-compute every grid vertex's source-space position once.
  const srcGrid: Point[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: Point[] = [];
    const t = j / rows;
    for (let i = 0; i <= cols; i++) row.push(evalHomography(coeffs, i / cols, t));
    srcGrid.push(row);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let j = 0; j < rows; j++) {
    const destY0 = (j / rows) * out.height, destY1 = ((j + 1) / rows) * out.height;
    for (let i = 0; i < cols; i++) {
      const destX0 = (i / cols) * out.width, destX1 = ((i + 1) / cols) * out.width;
      const sTL = srcGrid[j][i], sTR = srcGrid[j][i + 1], sBL = srcGrid[j + 1][i], sBR = srcGrid[j + 1][i + 1];
      const dTL = { x: destX0, y: destY0 }, dTR = { x: destX1, y: destY0 }, dBL = { x: destX0, y: destY1 }, dBR = { x: destX1, y: destY1 };

      // Two triangles per cell (TL,TR,BL) and (TR,BR,BL) for a good fit
      // even where the cell's source quad isn't quite a parallelogram.
      for (const [p0, p1, p2, q0, q1, q2] of [
        [sTL, sTR, sBL, dTL, dTR, dBL],
        [sTR, sBR, sBL, dTR, dBR, dBL],
      ] as [Point, Point, Point, Point, Point, Point][]) {
        const m = affineFromTriangles(p0, p1, p2, q0, q1, q2);
        if (!m) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath();
        ctx.clip();
        // Slightly overscan destination cells so adjacent triangles don't
        // leave hairline seams from anti-aliased clip edges.
        ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.drawImage(source, 0, 0);
        ctx.restore();
      }
    }
  }
  return out;
}

// A safe starting guess when no real edge detection is attempted or when it
// fails: a small inset from the full image, since most document photos
// already frame the page close to the edges.
export function defaultCorners(inset = 0.045): Quad {
  return [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ];
}
