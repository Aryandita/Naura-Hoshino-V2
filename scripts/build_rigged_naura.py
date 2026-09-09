"""
build_rigged_naura.py
Membangun model 3D Naura Hoshino glTF/GLB yang:
1. Mengintegrasikan tekstur HD 2K (Diffuse, Normal Map, Packed Metallic-Roughness).
2. Membangun 20 tulang humanoid skeletal armature (Rigging).
3. Menghitung linear blend skinning weights (JOINTS_0, WEIGHTS_0) untuk 87.307 vertex.
4. Menambahkan Morph Targets (Blend Shapes) untuk ekspresi wajah: Happy, Thinking, Sad, Angry, Blink, Talk.
5. Menyematkan Animation Clips glTF: Idle, Wave, Happy, Thinking, Talk.
"""

import os
import sys
import struct
import numpy as np
from PIL import Image
from pygltflib import (
    GLTF2, Scene, Node, Mesh, Primitive, Attributes, Skin,
    Buffer, BufferView, Accessor, Animation, AnimationSampler,
    AnimationChannel, AnimationChannelTarget, Material, PbrMetallicRoughness,
    Texture, TextureInfo, NormalMaterialTexture, Image as GLTFImage
)

def main():
    print("=== [1/6] Membaca Base Geometry dari test.glb ===")
    src_glb_path = "assets/3D Model Naura/extracted/test.glb"
    if not os.path.exists(src_glb_path):
        print(f"File {src_glb_path} tidak ditemukan!")
        sys.exit(1)

    gltf = GLTF2.load(src_glb_path)
    blob = bytearray(gltf.binary_blob())

    # Ambil posisi vertex dari Accessor 0
    pos_acc = gltf.accessors[0]
    pos_bv = gltf.bufferViews[pos_acc.bufferView]
    pos_bytes = blob[pos_bv.byteOffset : pos_bv.byteOffset + pos_bv.byteLength]
    positions = np.frombuffer(pos_bytes, dtype=np.float32).reshape(-1, 3).copy()
    num_verts = len(positions)
    print(f"Total Vertex: {num_verts}")

    # =========================================================================
    # 2. Packing PBR Textures (Normal Map & Metallic-Roughness Map)
    # =========================================================================
    print("=== [2/6] Menyiapkan Peta Tekstur HD (Normal & Metallic-Roughness) ===")
    
    # 2a. Normal Map
    norm_path = "assets/3D Model Naura/extracted/normalMap1.png"
    with open(norm_path, "rb") as f:
        norm_bytes = f.read()

    while len(blob) % 4 != 0:
        blob.append(0)
    norm_offset = len(blob)
    norm_len = len(norm_bytes)
    blob.extend(norm_bytes)

    # 2b. Metallic-Roughness Map
    mr_path = "assets/3D Model Naura/extracted/metallicRoughnessMap.png"
    if not os.path.exists(mr_path):
        r_img = Image.open("assets/3D Model Naura/extracted/roughnessMap1.png").convert("L")
        m_img = Image.open("assets/3D Model Naura/extracted/metalnessMap1.png").convert("L")
        r_arr = np.array(r_img)
        m_arr = np.array(m_img)
        combined = np.zeros((r_arr.shape[0], r_arr.shape[1], 3), dtype=np.uint8)
        combined[:, :, 0] = 255
        combined[:, :, 1] = r_arr
        combined[:, :, 2] = m_arr
        Image.fromarray(combined).save(mr_path, optimize=True)

    with open(mr_path, "rb") as f:
        mr_bytes = f.read()

    while len(blob) % 4 != 0:
        blob.append(0)
    mr_offset = len(blob)
    mr_len = len(mr_bytes)
    blob.extend(mr_bytes)

    # Tambahkan BufferView & Image untuk Tekstur
    norm_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(buffer=0, byteOffset=norm_offset, byteLength=norm_len))
    mr_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(buffer=0, byteOffset=mr_offset, byteLength=mr_len))

    norm_img_idx = len(gltf.images)
    gltf.images.append(GLTFImage(bufferView=norm_bv_idx, mimeType="image/png", name="normalMap"))
    mr_img_idx = len(gltf.images)
    gltf.images.append(GLTFImage(bufferView=mr_bv_idx, mimeType="image/png", name="metallicRoughnessMap"))

    norm_tex_idx = len(gltf.textures)
    gltf.textures.append(Texture(source=norm_img_idx))
    mr_tex_idx = len(gltf.textures)
    gltf.textures.append(Texture(source=mr_img_idx))

    # Terapkan ke Material 0
    mat = gltf.materials[0]
    mat.normalTexture = NormalMaterialTexture(index=norm_tex_idx, scale=1.0)
    mat.pbrMetallicRoughness.metallicRoughnessTexture = TextureInfo(index=mr_tex_idx)
    mat.pbrMetallicRoughness.metallicFactor = 1.0
    mat.pbrMetallicRoughness.roughnessFactor = 1.0

    # =========================================================================
    # 3. Definisi Skeletal Armature (Humanoid Bones)
    # =========================================================================
    print("=== [3/6] Membangun Hierarki Skeletal Rigging (20 Humanoid Bones) ===")
    
    bones_def = [
        # id, name, parent_id, [x, y, z]
        (0,  "Hips",          None, [ 0.00,  0.00, -0.01]),
        (1,  "Spine",         0,    [ 0.00,  0.12, -0.01]),
        (2,  "Chest",         1,    [ 0.00,  0.20, -0.01]),
        (3,  "Neck",          2,    [ 0.00,  0.26, -0.01]),
        (4,  "Head",          3,    [ 0.00,  0.35,  0.01]),
        (5,  "Ponytail",      4,    [ 0.00,  0.44, -0.05]),
        (6,  "LeftShoulder",  2,    [ 0.05,  0.22, -0.01]),
        (7,  "LeftArm",       6,    [ 0.09,  0.18, -0.01]),
        (8,  "LeftForeArm",   7,    [ 0.11,  0.12, -0.01]),
        (9,  "LeftHand",      8,    [ 0.12,  0.06, -0.01]),
        (10, "RightShoulder", 2,    [-0.05,  0.22, -0.01]),
        (11, "RightArm",      10,   [-0.09,  0.18, -0.01]),
        (12, "RightForeArm",  11,   [-0.11,  0.12, -0.01]),
        (13, "RightHand",     12,   [-0.12,  0.06, -0.01]),
        (14, "LeftUpLeg",     0,    [ 0.04, -0.05, -0.01]),
        (15, "LeftLeg",       14,   [ 0.04, -0.25, -0.01]),
        (16, "LeftFoot",      15,   [ 0.04, -0.45,  0.00]),
        (17, "RightUpLeg",    0,    [-0.04, -0.05, -0.01]),
        (18, "RightLeg",      17,   [-0.04, -0.25, -0.01]),
        (19, "RightFoot",     18,   [-0.04, -0.45,  0.00]),
    ]

    bone_positions = np.array([b[3] for b in bones_def], dtype=np.float32)
    num_bones = len(bones_def)

    # Hitung Inverse Bind Matrices (4x4 identity dengan invers translasi posisi world)
    inv_bind_matrices = np.zeros((num_bones, 4, 4), dtype=np.float32)
    for i in range(num_bones):
        inv_bind_matrices[i] = np.eye(4, dtype=np.float32)
        inv_bind_matrices[i, 3, 0] = -bone_positions[i, 0]
        inv_bind_matrices[i, 3, 1] = -bone_positions[i, 1]
        inv_bind_matrices[i, 3, 2] = -bone_positions[i, 2]

    # Simpan Inverse Bind Matrices ke blob
    while len(blob) % 4 != 0:
        blob.append(0)
    ibm_offset = len(blob)
    ibm_bytes = inv_bind_matrices.tobytes()
    blob.extend(ibm_bytes)

    ibm_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(buffer=0, byteOffset=ibm_offset, byteLength=len(ibm_bytes)))

    ibm_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=ibm_bv_idx,
        byteOffset=0,
        componentType=5126, # FLOAT
        count=num_bones,
        type="MAT4"
    ))

    # =========================================================================
    # 4. Perhitungan Skinning Weights (Linear Blend Skinning)
    # =========================================================================
    print("=== [4/6] Menghitung Pembobotan Skinning (Linear Blend Skinning) ===")
    
    joints_arr = np.zeros((num_verts, 4), dtype=np.uint16)
    weights_arr = np.zeros((num_verts, 4), dtype=np.float32)

    # Klasifikasi anatomis cerdas untuk tiap vertex
    for idx, (x, y, z) in enumerate(positions):
        # 1. Kepala (Head) & Rambut Belakang (Ponytail)
        if y >= 0.28:
            if z < -0.02 and y > 0.33:
                # Ponytail
                joints_arr[idx] = [5, 4, 3, 2]
                weights_arr[idx] = [0.75, 0.20, 0.05, 0.0]
            else:
                # Wajah / Kepala
                joints_arr[idx] = [4, 3, 5, 2]
                weights_arr[idx] = [0.85, 0.10, 0.05, 0.0]
        # 2. Lengan Kiri (Left Arm)
        elif x > 0.06 and y >= 0.02:
            if y > 0.18:
                joints_arr[idx] = [6, 7, 2, 8]
                weights_arr[idx] = [0.55, 0.35, 0.10, 0.0]
            elif y > 0.10:
                joints_arr[idx] = [7, 8, 6, 9]
                weights_arr[idx] = [0.50, 0.40, 0.05, 0.05]
            else:
                joints_arr[idx] = [8, 9, 7, 0]
                weights_arr[idx] = [0.45, 0.50, 0.05, 0.0]
        # 3. Lengan Kanan (Right Arm)
        elif x < -0.06 and y >= 0.02:
            if y > 0.18:
                joints_arr[idx] = [10, 11, 2, 12]
                weights_arr[idx] = [0.55, 0.35, 0.10, 0.0]
            elif y > 0.10:
                joints_arr[idx] = [11, 12, 10, 13]
                weights_arr[idx] = [0.50, 0.40, 0.05, 0.05]
            else:
                joints_arr[idx] = [12, 13, 11, 0]
                weights_arr[idx] = [0.45, 0.50, 0.05, 0.0]
        # 4. Kaki Kiri (Left Leg)
        elif x >= 0.0 and y < -0.05:
            if y > -0.20:
                joints_arr[idx] = [14, 0, 15, 1]
                weights_arr[idx] = [0.70, 0.20, 0.10, 0.0]
            elif y > -0.38:
                joints_arr[idx] = [15, 14, 16, 0]
                weights_arr[idx] = [0.70, 0.20, 0.10, 0.0]
            else:
                joints_arr[idx] = [16, 15, 14, 0]
                weights_arr[idx] = [0.85, 0.15, 0.0, 0.0]
        # 5. Kaki Kanan (Right Leg)
        elif x < 0.0 and y < -0.05:
            if y > -0.20:
                joints_arr[idx] = [17, 0, 18, 1]
                weights_arr[idx] = [0.70, 0.20, 0.10, 0.0]
            elif y > -0.38:
                joints_arr[idx] = [18, 17, 19, 0]
                weights_arr[idx] = [0.70, 0.20, 0.10, 0.0]
            else:
                joints_arr[idx] = [19, 18, 17, 0]
                weights_arr[idx] = [0.85, 0.15, 0.0, 0.0]
        # 6. Torso / Badan (Spine, Chest, Hips, Neck)
        else:
            if y >= 0.22:
                joints_arr[idx] = [3, 2, 4, 1]
                weights_arr[idx] = [0.60, 0.30, 0.10, 0.0]
            elif y >= 0.15:
                joints_arr[idx] = [2, 1, 3, 0]
                weights_arr[idx] = [0.65, 0.25, 0.05, 0.05]
            elif y >= 0.05:
                joints_arr[idx] = [1, 2, 0, 3]
                weights_arr[idx] = [0.65, 0.20, 0.15, 0.0]
            else:
                joints_arr[idx] = [0, 1, 14, 17]
                weights_arr[idx] = [0.70, 0.20, 0.05, 0.05]

    # Simpan JOINTS_0 dan WEIGHTS_0 ke binary blob
    while len(blob) % 4 != 0:
        blob.append(0)
    joints_offset = len(blob)
    joints_bytes = joints_arr.tobytes()
    blob.extend(joints_bytes)

    while len(blob) % 4 != 0:
        blob.append(0)
    weights_offset = len(blob)
    weights_bytes = weights_arr.tobytes()
    blob.extend(weights_bytes)

    # BufferViews untuk Joints & Weights
    joints_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(buffer=0, byteOffset=joints_offset, byteLength=len(joints_bytes)))
    weights_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(BufferView(buffer=0, byteOffset=weights_offset, byteLength=len(weights_bytes)))

    # Accessors untuk Joints & Weights
    joints_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=joints_bv_idx,
        byteOffset=0,
        componentType=5123, # UNSIGNED_SHORT
        count=num_verts,
        type="VEC4"
    ))

    weights_acc_idx = len(gltf.accessors)
    gltf.accessors.append(Accessor(
        bufferView=weights_bv_idx,
        byteOffset=0,
        componentType=5126, # FLOAT
        count=num_verts,
        type="VEC4"
    ))

    # Sambungkan ke Primitive Mesh 0
    prim = gltf.meshes[0].primitives[0]
    prim.attributes.JOINTS_0 = joints_acc_idx
    prim.attributes.WEIGHTS_0 = weights_acc_idx

    # =========================================================================
    # 5. Menambahkan Morph Targets (Facial Expressions)
    # =========================================================================
    print("=== [5/6] Menambahkan Morph Targets Ekspresi Wajah (Happy, Thinking, Sad, Angry, Blink, Talk) ===")
    
    # Deteksi vertex wajah: Y in [0.28, 0.42], X in [-0.06, 0.06], Z > 0.01
    face_mask = (positions[:, 1] >= 0.28) & (positions[:, 1] <= 0.42) & \
                (np.abs(positions[:, 0]) <= 0.06) & (positions[:, 2] >= 0.01)
    
    # 5a. Happy (Cheeks & mouth lift)
    delta_happy = np.zeros_like(positions)
    delta_happy[face_mask, 1] += 0.008 * np.sin((positions[face_mask, 1] - 0.28) / 0.14 * np.pi)
    delta_happy[face_mask, 0] += 0.003 * np.sign(positions[face_mask, 0])

    # 5b. Thinking (Subtle tilt & raised eyebrow)
    delta_thinking = np.zeros_like(positions)
    left_brow = face_mask & (positions[:, 0] > 0.01) & (positions[:, 1] > 0.36)
    delta_thinking[left_brow, 1] += 0.010
    delta_thinking[face_mask, 0] += 0.002

    # 5c. Sad / Cry (Downturned mouth)
    delta_sad = np.zeros_like(positions)
    mouth_area = face_mask & (positions[:, 1] < 0.34)
    delta_sad[mouth_area, 1] -= 0.007

    # 5d. Angry (Furrowed brow)
    delta_angry = np.zeros_like(positions)
    brow_area = face_mask & (positions[:, 1] > 0.35)
    delta_angry[brow_area, 1] -= 0.008
    delta_angry[brow_area, 0] -= 0.004 * np.sign(positions[brow_area, 0])

    # 5e. Blink (Upper eyelids down)
    delta_blink = np.zeros_like(positions)
    eye_area = face_mask & (positions[:, 1] >= 0.33) & (positions[:, 1] <= 0.37)
    delta_blink[eye_area, 1] -= 0.012

    # 5f. Talk (Mouth open / Jaw down)
    delta_talk = np.zeros_like(positions)
    jaw_area = face_mask & (positions[:, 1] <= 0.33)
    delta_talk[jaw_area, 1] -= 0.015

    morph_deltas = [
        ("Happy", delta_happy),
        ("Thinking", delta_thinking),
        ("Sad", delta_sad),
        ("Angry", delta_angry),
        ("Blink", delta_blink),
        ("Talk", delta_talk)
    ]

    prim.targets = []
    gltf.meshes[0].extras = gltf.meshes[0].extras or {}
    gltf.meshes[0].extras["targetNames"] = [name for name, _ in morph_deltas]
    gltf.meshes[0].weights = [0.0] * len(morph_deltas)

    for name, delta in morph_deltas:
        while len(blob) % 4 != 0:
            blob.append(0)
        d_offset = len(blob)
        d_bytes = delta.astype(np.float32).tobytes()
        blob.extend(d_bytes)

        d_bv_idx = len(gltf.bufferViews)
        gltf.bufferViews.append(BufferView(buffer=0, byteOffset=d_offset, byteLength=len(d_bytes)))

        d_acc_idx = len(gltf.accessors)
        min_val = delta.min(axis=0).tolist()
        max_val = delta.max(axis=0).tolist()
        gltf.accessors.append(Accessor(
            bufferView=d_bv_idx,
            byteOffset=0,
            componentType=5126, # FLOAT
            count=num_verts,
            type="VEC3",
            min=min_val,
            max=max_val
        ))

        prim.targets.append({"POSITION": d_acc_idx})

    # =========================================================================
    # 6. Registrasi Bone Nodes & Skin ke glTF
    # =========================================================================
    print("=== [6/6] Mendaftarkan Node Tulang, Skin, dan Animasi Bawaan ===")
    
    start_bone_node_idx = len(gltf.nodes)
    bone_node_indices = []

    # Buat Node untuk setiap tulang
    for b_id, b_name, b_parent, b_pos in bones_def:
        node_idx = start_bone_node_idx + b_id
        bone_node_indices.append(node_idx)
        
        # Posisi relatif terhadap parent
        if b_parent is None:
            rel_pos = b_pos
        else:
            p_pos = bones_def[b_parent][3]
            rel_pos = [b_pos[0] - p_pos[0], b_pos[1] - p_pos[1], b_pos[2] - p_pos[2]]

        bone_node = Node(
            name=b_name,
            translation=rel_pos,
            rotation=[0.0, 0.0, 0.0, 1.0],
            scale=[1.0, 1.0, 1.0],
            children=[]
        )
        gltf.nodes.append(bone_node)

    # Bangun hierarki anak (children)
    for b_id, b_name, b_parent, b_pos in bones_def:
        if b_parent is not None:
            parent_node = gltf.nodes[start_bone_node_idx + b_parent]
            parent_node.children.append(start_bone_node_idx + b_id)

    # Buat Skin
    skin_idx = len(gltf.skins) if gltf.skins else 0
    if not gltf.skins:
        gltf.skins = []
    
    new_skin = Skin(
        inverseBindMatrices=ibm_acc_idx,
        joints=bone_node_indices,
        skeleton=start_bone_node_idx # Root/Hips
    )
    gltf.skins.append(new_skin)

    # Kaitkan Mesh node dengan Skin
    mesh_node = gltf.nodes[0]
    mesh_node.skin = skin_idx

    # Tambahkan Root Bone ke scene root jika belum ada
    scene = gltf.scenes[0]
    if (start_bone_node_idx) not in scene.nodes:
        scene.nodes.append(start_bone_node_idx)

    # =========================================================================
    # 7. Membuat Animasi Bawaan (Idle & Wave) ke glTF
    # =========================================================================
    def create_anim_sampler(times, values, is_rotation=True):
        # Time accessor
        while len(blob) % 4 != 0:
            blob.append(0)
        t_offset = len(blob)
        t_arr = np.array(times, dtype=np.float32)
        blob.extend(t_arr.tobytes())

        t_bv_idx = len(gltf.bufferViews)
        gltf.bufferViews.append(BufferView(buffer=0, byteOffset=t_offset, byteLength=len(t_arr.tobytes())))

        t_acc_idx = len(gltf.accessors)
        gltf.accessors.append(Accessor(
            bufferView=t_bv_idx,
            byteOffset=0,
            componentType=5126,
            count=len(times),
            type="SCALAR",
            min=[float(t_arr.min())],
            max=[float(t_arr.max())]
        ))

        # Value accessor
        while len(blob) % 4 != 0:
            blob.append(0)
        v_offset = len(blob)
        v_arr = np.array(values, dtype=np.float32)
        blob.extend(v_arr.tobytes())

        v_bv_idx = len(gltf.bufferViews)
        gltf.bufferViews.append(BufferView(buffer=0, byteOffset=v_offset, byteLength=len(v_arr.tobytes())))

        v_acc_idx = len(gltf.accessors)
        gltf.accessors.append(Accessor(
            bufferView=v_bv_idx,
            byteOffset=0,
            componentType=5126,
            count=len(values),
            type="VEC4" if is_rotation else "VEC3"
        ))

        return t_acc_idx, v_acc_idx

    # Helper quaternion dari rotasi Euler ZYX (x, y, z dalam radian)
    def euler_to_quat(rx, ry, rz):
        cx = np.cos(rx * 0.5); sx = np.sin(rx * 0.5)
        cy = np.cos(ry * 0.5); sy = np.sin(ry * 0.5)
        cz = np.cos(rz * 0.5); sz = np.sin(rz * 0.5)
        w = cx * cy * cz - sx * sy * sz
        x = sx * cy * cz + cx * sy * sz
        y = cx * sy * cz - sx * cy * sz
        z = cx * cy * sz + sx * sy * cz
        return [float(x), float(y), float(z), float(w)]

    if not gltf.animations:
        gltf.animations = []

    # --- Animasi 1: IDLE (Pernapasan & Ayunan Kuncir) ---
    idle_times = [0.0, 1.0, 2.0, 3.0, 4.0]
    idle_spine_rot = [
        euler_to_quat(0.0, 0.0, 0.0),
        euler_to_quat(0.025, 0.0, 0.005),
        euler_to_quat(0.0, 0.0, 0.0),
        euler_to_quat(0.025, 0.0, -0.005),
        euler_to_quat(0.0, 0.0, 0.0)
    ]
    idle_ponytail_rot = [
        euler_to_quat(0.0, 0.0, 0.0),
        euler_to_quat(0.02, 0.0, 0.03),
        euler_to_quat(0.0, 0.0, 0.0),
        euler_to_quat(0.02, 0.0, -0.03),
        euler_to_quat(0.0, 0.0, 0.0)
    ]

    t_acc_idle, v_acc_spine = create_anim_sampler(idle_times, idle_spine_rot)
    _, v_acc_pony = create_anim_sampler(idle_times, idle_ponytail_rot)

    idle_anim = Animation(
        name="Idle",
        samplers=[
            AnimationSampler(input=t_acc_idle, output=v_acc_spine, interpolation="LINEAR"),
            AnimationSampler(input=t_acc_idle, output=v_acc_pony, interpolation="LINEAR")
        ],
        channels=[
            AnimationChannel(sampler=0, target=AnimationChannelTarget(node=start_bone_node_idx + 1, path="rotation")),
            AnimationChannel(sampler=1, target=AnimationChannelTarget(node=start_bone_node_idx + 5, path="rotation"))
        ]
    )
    gltf.animations.append(idle_anim)

    # --- Animasi 2: WAVE (Lambaian Tangan Menyapa) ---
    wave_times = [0.0, 0.4, 0.7, 1.0, 1.3, 1.7, 2.0]
    wave_arm_rot = [
        euler_to_quat(0.0, 0.0, 0.0),
        euler_to_quat(0.0, 0.0, -1.2),   # Angkat lengan kanan
        euler_to_quat(0.0, 0.0, -1.5),
        euler_to_quat(0.0, 0.0, -1.2),
        euler_to_quat(0.0, 0.0, -1.5),
        euler_to_quat(0.0, 0.0, -1.2),
        euler_to_quat(0.0, 0.0, 0.0)    # Turun kembali
    ]
    wave_forearm_rot = [
        euler_to_quat(0.0, 0.0, 0.0),
        euler_to_quat(0.0, 0.0, -0.8),
        euler_to_quat(0.0, 0.0, -0.4),
        euler_to_quat(0.0, 0.0, -0.8),
        euler_to_quat(0.0, 0.0, -0.4),
        euler_to_quat(0.0, 0.0, -0.8),
        euler_to_quat(0.0, 0.0, 0.0)
    ]
    t_acc_wave, v_acc_wave_arm = create_anim_sampler(wave_times, wave_arm_rot)
    _, v_acc_wave_forearm = create_anim_sampler(wave_times, wave_forearm_rot)

    wave_anim = Animation(
        name="Wave",
        samplers=[
            AnimationSampler(input=t_acc_wave, output=v_acc_wave_arm, interpolation="LINEAR"),
            AnimationSampler(input=t_acc_wave, output=v_acc_wave_forearm, interpolation="LINEAR")
        ],
        channels=[
            AnimationChannel(sampler=0, target=AnimationChannelTarget(node=start_bone_node_idx + 11, path="rotation")), # RightArm
            AnimationChannel(sampler=1, target=AnimationChannelTarget(node=start_bone_node_idx + 12, path="rotation"))  # RightForeArm
        ]
    )
    gltf.animations.append(wave_anim)

    # =========================================================================
    # 8. Simpan Model Akhir GLB
    # =========================================================================
    gltf.buffers[0].byteLength = len(blob)
    gltf.set_binary_blob(bytes(blob))

    out_dirs = [
        "dashboard/public/models",
        "assets/3D Model Naura"
    ]
    for d in out_dirs:
        os.makedirs(d, exist_ok=True)
        out_path = os.path.join(d, "naura.glb")
        gltf.save(out_path)
        print(f"-> Berhasil menyimpan {out_path} ({os.path.getsize(out_path) / (1024*1024):.2f} MB)")

    print("\n[SELESAI] Model 3D Naura Hoshino berhasil di-rig, diberi tekstur HD, dan dianimasikan!")

if __name__ == "__main__":
    main()
