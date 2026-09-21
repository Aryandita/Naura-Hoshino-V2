#!/usr/bin/env python3
"""
apply_skin_fix.py - Memperbaiki model Naura (GLB / VRM) agar animasi lengan terlihat alami.

Yang diperbaiki (semuanya idempoten; bisa dijalankan pada file ASLI maupun file hasil versi lama):
  1. Bobot skinning bocor  : ~17.000 vertex rok/paha/blazer/rambut terbobot ke tulang tangan/lengan/bahu, sehingga
                             rok dan rambut tertarik saat lengan diangkat. Bobotnya diganti dengan bobot badan terdekat.
  2. Segitiga jahitan      : segitiga yang menghubungkan tangan ke rok/pinggul dibuang; segitiga ketiak (yang sempat
                             ikut terbuang di versi lama dan menyebabkan robekan blazer) dipulihkan.
  3. Bobot lengan mulus    : pembagian bobot Arm/ForeArm/Hand dihitung ulang sebagai fungsi mulus dari tinggi, sama untuk
                             semua lapisan pakaian. Aslinya jari hanya 80% dibobot ke tangan dan lengan atas 15-27% ke
                             lengan bawah, sehingga tangan mengecil, siku lembek, dan lapisan baju saling menembus.
  4. Sendi lengan          : bahu/siku/pergelangan dipindah ke tengah mesh lengan (aslinya 5 cm di belakang mesh dan
                             sendi tangan di tengah telapak). Pose diam tidak berubah.
  5. Ukuran tangan         : tulang tangan diskalakan 1.25x (skala node) agar proporsional dengan kepala.
UV, morph target, animasi bawaan, ekstensi VRM, dan tekstur tidak disentuh.

Pemakaian : python apply_skin_fix.py  model_lama.vrm  model_baru.vrm
Persyaratan: Python 3 + numpy. 'skin_fix_data.npz' harus satu folder dengan skrip ini.
Aman      : file asli tidak diubah; file yang meshnya berbeda ditolak (checksum posisi); file yang sudah versi terbaru ditolak.
"""
import json, struct, sys, hashlib, os
import numpy as np

VERSION = "naura-fix v4 (bobot+ketiak+lengan-mulus+sendi+tangan1.25)"
HAND_SCALE = 1.25
CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
NEW_JOINTS = {
    "RightArm": (0.045, 0.180, -0.098), "RightForeArm": (0.050, 0.090, -0.108), "RightHand": (0.055, 0.005, -0.122),
    "LeftArm": (0.045, 0.180, 0.098), "LeftForeArm": (0.050, 0.090, 0.108), "LeftHand": (0.055, 0.005, 0.122),
}
OLD_JOINTS = {"RightArm": (0, .18, -.09), "RightForeArm": (0, .08, -.11), "RightHand": (0, -.04, -.12),
              "LeftArm": (0, .18, .09), "LeftForeArm": (0, .08, .11), "LeftHand": (0, -.04, .12)}


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, total = struct.unpack("<III", data[:12])
    if magic != 0x46546C67: sys.exit("Bukan file GLB/VRM biner (.glb / .vrm).")
    chunks, off = [], 12
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunks.append([ctype, bytearray(data[off + 8:off + 8 + clen])]); off += 8 + clen
    return chunks


def write_glb(path, chunks):
    body = b""
    for ctype, payload in chunks:
        pad = (-len(payload)) % 4
        payload = bytes(payload) + (b" " if ctype == 0x4E4F534A else b"\0") * pad
        body += struct.pack("<II", len(payload), ctype) + payload
    open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body)


def locate(js, idx):
    acc = js["accessors"][idx]; view = js["bufferViews"][acc["bufferView"]]
    dt, n = np.dtype(CT[acc["componentType"]]), NC[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    return acc, dt, n, start, view.get("byteStride") or dt.itemsize * n


def read_acc(buf, js, idx):
    acc, dt, n, start, stride = locate(js, idx)
    out = np.empty((acc["count"], n), dtype=dt)
    for i in range(acc["count"]): out[i] = np.frombuffer(buf, dtype=dt, count=n, offset=start + i * stride)
    return out


def write_acc(buf, js, idx, arr):
    acc, dt, n, start, stride = locate(js, idx)
    for i in range(len(arr)):
        buf[start + i * stride: start + i * stride + dt.itemsize * n] = np.asarray(arr[i], dtype=dt).tobytes()


def smoothstep(x): x = np.clip(x, 0.0, 1.0); return x * x * (3 - 2 * x)


def smooth_arm_skin(JT, WT, POS, joint_names, y_elbow=0.09, b_elbow=0.03, y_wrist=0.005, b_wrist=0.012):
    """Bagi bobot Arm/ForeArm/Hand sebagai fungsi mulus tinggi y; total pengaruh lengan & bobot bone lain dipertahankan."""
    JT = JT.astype(np.int64).copy(); WT = WT.astype(np.float64).copy()
    idx = {nm: i for i, nm in enumerate(joint_names)}
    for side in ("Left", "Right"):
        ia, ifo, ih = idx[side + "Arm"], idx[side + "ForeArm"], idx[side + "Hand"]
        T = (WT * (np.isin(JT, [ia, ifo, ih]) & (WT > 0))).sum(1)
        rows = np.where(T > 1e-6)[0]; y = POS[rows, 1]
        fe = smoothstep((y_elbow + b_elbow - y) / (2 * b_elbow)); fw = smoothstep((y_wrist + b_wrist - y) / (2 * b_wrist))
        wa, wf, wh = T[rows] * (1 - fe), T[rows] * fe * (1 - fw), T[rows] * fe * fw
        for k, r in enumerate(rows):
            new = [(int(JT[r, s]), float(WT[r, s])) for s in range(4) if WT[r, s] > 0 and JT[r, s] not in (ia, ifo, ih)]
            new += [(ia, wa[k]), (ifo, wf[k]), (ih, wh[k])]
            new = sorted([(j, w) for j, w in new if w > 1e-5], key=lambda t: -t[1])[:4]
            tot = sum(w for _, w in new); new = [(j, w / tot) for j, w in new]
            while len(new) < 4: new.append((0, 0.0))
            JT[r] = [j for j, _ in new]; WT[r] = [w for _, w in new]
    return JT, WT


def tri_keys(tris, nv):
    s = np.sort(tris.astype(np.int64), axis=1)
    return (s[:, 0] * nv + s[:, 1]) * nv + s[:, 2]


def rerig_arms(js, buf):
    nodes = js["nodes"]; by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    if any(k not in by_name for k in NEW_JOINTS): print("PERINGATAN: bone lengan tidak lengkap, re-rig dilewati."); return 0

    def world(i, override):
        if nodes[i].get("name") in override: return np.array(override[nodes[i]["name"]], float)
        p = np.array(nodes[i].get("translation", [0, 0, 0]), float)
        while i in parent: i = parent[i]; p = p + np.array(nodes[i].get("translation", [0, 0, 0]), float)
        return p

    old = {k: world(by_name[k], {}) for k in NEW_JOINTS}
    if all(np.allclose(old[k], NEW_JOINTS[k], atol=1e-4) for k in NEW_JOINTS): return 0            # sudah benar
    if not all(np.allclose(old[k], OLD_JOINTS[k], atol=1e-4) for k in NEW_JOINTS):
        sys.exit("DITOLAK (re-rig): posisi sendi lengan model ini tidak dikenali.")
    for name, pos in NEW_JOINTS.items():
        i = by_name[name]; pw = world(parent[i], NEW_JOINTS)
        nodes[i]["translation"] = [round(float(pos[k] - pw[k]), 6) for k in range(3)]
    skin = js["skins"][0]; acc, dt, n, start, stride = locate(js, skin["inverseBindMatrices"])
    ibm = read_acc(buf, js, skin["inverseBindMatrices"])
    for k, j in enumerate(skin["joints"]):
        nm = nodes[j].get("name")
        if nm in NEW_JOINTS:
            m = ibm[k].astype(np.float64).copy(); m[12:15] = -np.array(NEW_JOINTS[nm]); ibm[k] = m.astype(dt)
    write_acc(buf, js, skin["inverseBindMatrices"], ibm)
    return len(NEW_JOINTS)


def main(src, dst, fix_path):
    fix = np.load(fix_path); chunks = read_glb(src)
    js_chunk = next(c for c in chunks if c[0] == 0x4E4F534A); bin_chunk = next(c for c in chunks if c[0] == 0x004E4942)
    js, buf = json.loads(bytes(js_chunk[1])), bin_chunk[1]
    if js.get("asset", {}).get("extras", {}).get("naura_fix") == VERSION:
        sys.exit("Model ini sudah versi perbaikan terbaru. Tidak ada yang perlu dilakukan.")
    prim = js["meshes"][0]["primitives"][0]
    pos = read_acc(buf, js, prim["attributes"]["POSITION"]); nv = len(pos)
    if nv != int(fix["n_vertices"]) or hashlib.sha1(pos.tobytes()).hexdigest() != str(fix["pos_sha1"]):
        sys.exit("DITOLAK: mesh model ini tidak sama dengan mesh yang dipakai untuk membuat patch.")

    # 1+3. bobot: baris hasil perbaikan, lalu pembagian mulus antar tulang lengan
    j_idx, w_idx = prim["attributes"]["JOINTS_0"], prim["attributes"]["WEIGHTS_0"]
    joints, weights = read_acc(buf, js, j_idx), read_acc(buf, js, w_idx)
    rows = fix["rows"]; joints[rows], weights[rows] = fix["joints"].astype(joints.dtype), fix["weights"].astype(weights.dtype)
    names = [js["nodes"][j].get("name") for j in js["skins"][0]["joints"]]
    joints, weights = smooth_arm_skin(joints, weights, pos.astype(np.float64), names)
    write_acc(buf, js, j_idx, joints.astype(CT[js["accessors"][j_idx]["componentType"]]))
    write_acc(buf, js, w_idx, weights.astype(np.float32))

    # 2. segitiga: buang jahitan (per triple vertex), pulihkan ketiak bila hilang (aman untuk file versi lama)
    acc, dt, n, start, stride = locate(js, prim["indices"])
    tris = read_acc(buf, js, prim["indices"]).reshape(-1, 3).astype(np.int64)
    drop = np.isin(tri_keys(tris, nv), tri_keys(fix["removed_verts"], nv))
    tris = tris[~drop]
    missing = fix["restore_tris"].astype(np.int64)[~np.isin(tri_keys(fix["restore_tris"], nv), tri_keys(tris, nv))]
    restored = len(missing)
    if restored: tris = np.vstack([tris, missing])
    flat = tris.reshape(-1)
    cap = acc["count"]; old_count = cap
    write_acc(buf, js, prim["indices"], flat.reshape(-1, 1))
    if len(flat) < old_count: buf[start + len(flat) * dt.itemsize: start + old_count * dt.itemsize] = b"\0" * ((old_count - len(flat)) * dt.itemsize)
    acc["count"] = int(len(flat)); acc["min"], acc["max"] = [int(flat.min())], [int(flat.max())]

    # 4. sendi lengan, 5. ukuran tangan, penanda versi
    moved = rerig_arms(js, buf)
    for nm in ("LeftHand", "RightHand"):
        for nd in js["nodes"]:
            if nd.get("name") == nm: nd["scale"] = [HAND_SCALE] * 3
    js.setdefault("asset", {}).setdefault("extras", {})["naura_fix"] = VERSION
    js_chunk[1] = bytearray(json.dumps(js, separators=(",", ":")).encode("utf-8"))
    write_glb(dst, chunks)
    print(f"OK: {len(rows)} vertex diperbaiki + bobot lengan mulus, {int(drop.sum())} segitiga jahitan dibuang, "
          f"{restored} segitiga ketiak dipulihkan, {moved} sendi dipindah, tangan x{HAND_SCALE} -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], os.path.join(os.path.dirname(os.path.abspath(__file__)), "skin_fix_data.npz"))
