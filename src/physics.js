// physics.js
// Physics engine

export function touches(bb1, bb2) {
  // Returns true if the given bounding boxes touch each other.
  // Bounding box format is an array of four numbers specifying (left, top),
  // (right, bottom) coordinates in that order. Top and left coordinates are
  // smaller than bottom and right coordinates.
  let l1 = bb1[0];
  let t1 = bb1[1];
  let r1 = bb1[2];
  let b1 = bb1[3];
  let l2 = bb2[0];
  let t2 = bb2[1];
  let r2 = bb2[2];
  let b2 = bb2[3];
  return !(
    r1 < l2
 || l1 > r2
 || t1 > b2
 || b1 < t2
  );
}
