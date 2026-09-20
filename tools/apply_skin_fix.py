#!/usr/bin/env python3
"""
apply_skin_fix.py - Memperbaiki skinning model Naura (GLB / VRM) agar rok tidak ikut tertarik saat lengan diangkat.

Masalah asli : ~14.000 vertex rok/paha/blazer terbobot ke bone tangan & lengan bawah, plus ~420 segitiga
               "jahitan" yang menghubungkan tangan ke rok. Akibatnya kulit paha/rok melar menjadi lajur
               panjang saat tangan naik.
Perbaikan    : bobot vertex tersebut diganti dengan bobot vertex badan terdekat dan segitiga jahitan
               dibuang. Bagian lain (UV, morph target, animasi bawaan, ekstensi VRM, tekstur) tidak disentuh.

Pemakaian    : python apply_skin_fix.py  model_asli.vrm  model_baru.vrm
Persyaratan  : Python 3 + numpy. File data 'skin_fix_data.npz' harus satu folder dengan skrip ini.
Aman         : file asli tidak diubah; skrip menolak file yang meshnya tidak cocok (cek checksum posisi).
"""
import json, struct, sys, hashlib, os
import numpy as np

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, total = struct.unpack("<III", data[:12])
    if magic != 0x46546C67:
        sys.exit("Bukan file GLB/VRM biner (.glb / .vrm).")
    chunks, off = [], 12
    while off < len(data):
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunks.append([ctype, bytearray(data[off + 8:off + 8 + clen])])
        off += 8 + clen
    return chunks


def write_glb(path, chunks):
    body = b""
    for ctype, payload in chunks:
        pad = (-len(payload)) % 4
        payload = bytes(payload) + (b" " if ctype == 0x4E4F534A else b"\0") * pad
        body += struct.pack("<II", len(payload), ctype) + payload
    open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body)


def locate(js, idx):
    acc = js["accessors"][idx]
    view = js["bufferViews"][acc["bufferView"]]
    dt, n = np.dtype(CT[acc["componentType"]]), NC[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or dt.itemsize * n
    return acc, dt, n, start, stride


def read_acc(buf, js, idx):
    acc, dt, n, start, stride = locate(js, idx)
    out = np.empty((acc["count"], n), dtype=dt)
    for i in range(acc["count"]):
        out[i] = np.frombuffer(buf, dtype=dt, count=n, offset=start + i * stride)
    return out


def write_acc(buf, js, idx, arr):
    acc, dt, n, start, stride = locate(js, idx)
    for i in range(len(arr)):
        buf[start + i * stride: start + i * stride + dt.itemsize * n] = np.asarray(arr[i], dtype=dt).tobytes()


def main(src, dst, fix_path):
    fix = np.load(fix_path)
    chunks = read_glb(src)
    js_chunk = next(c for c in chunks if c[0] == 0x4E4F534A)
    bin_chunk = next(c for c in chunks if c[0] == 0x004E4942)
    js, buf = json.loads(bytes(js_chunk[1])), bin_chunk[1]

    prim = js["meshes"][0]["primitives"][0]
    pos = read_acc(buf, js, prim["attributes"]["POSITION"])
    if len(pos) != int(fix["n_vertices"]) or hashlib.sha1(pos.tobytes()).hexdigest() != str(fix["pos_sha1"]):
        sys.exit("DITOLAK: mesh model ini tidak sama dengan mesh yang dipakai untuk membuat patch.")

    j_idx, w_idx = prim["attributes"]["JOINTS_0"], prim["attributes"]["WEIGHTS_0"]
    joints, weights = read_acc(buf, js, j_idx), read_acc(buf, js, w_idx)
    rows = fix["rows"]
    joints[rows], weights[rows] = fix["joints"].astype(joints.dtype), fix["weights"].astype(weights.dtype)
    write_acc(buf, js, j_idx, joints)
    write_acc(buf, js, w_idx, weights)

    ind = read_acc(buf, js, prim["indices"]).reshape(-1, 3)
    keep = np.setdiff1d(np.arange(len(ind)), fix["removed_triangles"])
    new_ind = ind[keep].reshape(-1)
    acc, dt, n, start, stride = locate(js, prim["indices"])
    write_acc(buf, js, prim["indices"], new_ind.reshape(-1, 1))
    buf[start + len(new_ind) * dt.itemsize: start + acc["count"] * dt.itemsize] = b"\0" * ((acc["count"] - len(new_ind)) * dt.itemsize)
    acc["count"] = int(len(new_ind))
    acc["min"], acc["max"] = [int(new_ind.min())], [int(new_ind.max())]

    js_chunk[1] = bytearray(json.dumps(js, separators=(",", ":")).encode("utf-8"))
    write_glb(dst, chunks)
    print(f"OK: {len(rows)} vertex diperbaiki, {len(fix['removed_triangles'])} segitiga jahitan dibuang -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], os.path.join(os.path.dirname(os.path.abspath(__file__)), "skin_fix_data.npz"))
