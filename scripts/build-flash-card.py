"""Rebuild the site's subtly softened rectangular paper card.

Run: uv run python scripts/build-flash-card.py [--render]
Geometry/material-role export adapted from HRuiCcc's RuiC-card-skill (MIT).
"""

import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys

SITE = Path(__file__).resolve().parents[1]
PROJECT = SITE / "artifacts/flash-cards/bella-kira"


def launch():
    blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
    if not blender:
        blender = "/Applications/Blender.app/Contents/MacOS/Blender"
    if not Path(blender).is_file():
        raise SystemExit("Set BLENDER_BIN to a Blender executable.")
    config_dir = PROJECT / "tools/blender-config"
    config_dir.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, BLENDER_USER_CONFIG=str(config_dir))
    subprocess.run(
        [blender, "--background", "--factory-startup", "--python-exit-code", "1",
         "--python", str(Path(__file__).resolve()), "--", "--blender-job",
         *sys.argv[1:]],
        cwd=SITE, env=env, check=True,
    )


def rebuild():
    import bpy

    bpy.ops.wm.open_mainfile(filepath=str(PROJECT / "card.blend"))
    scene = bpy.context.scene
    # Saving a project must not write global preferences or desktop thumbnails.
    prefs = bpy.context.preferences.filepaths
    prefs.save_version = 0
    prefs.file_preview_type = "NONE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = .01  # one unit = one centimetre
    collection = bpy.data.collections["卡牌 · 可复用成品"]
    card = next(o for o in collection.objects if "主体平面" in o.name)
    pivot = bpy.data.objects["转卡控制 · 播放时间线预览"]
    pivot.animation_data_clear()
    pivot.rotation_euler = (0, 0, 0)
    for key in list(pivot.keys()):
        del pivot[key]
    pivot["纸芯厚度（毫米）"] = .35
    pivot["使用说明"] = "完整原画固定 UV；旋转观察涂布纸反光。无独立图层景深。"
    for ob in list(collection.objects):
        if ob.type == "MESH" and ob != card:
            bpy.data.objects.remove(ob, do_unlink=True)

    w, h, thickness, radius = 6.3, 9.45, .035, .06
    corners = []
    for cx, cy, start in [
        (w/2-radius, h/2-radius, 0), (-w/2+radius, h/2-radius, 90),
        (-w/2+radius, -h/2+radius, 180), (w/2-radius, -h/2+radius, 270),
    ]:
        for step in range(6):
            angle = math.radians(start + step * 18)
            corners.append((cx+radius*math.cos(angle), cy+radius*math.sin(angle)))
    count = len(corners)
    vertices = [(x, y, z) for z in (0, -thickness) for x, y in corners]
    faces = [tuple(range(count)), tuple(reversed(range(count, count*2)))]
    faces += [(i, i+count, (i+1) % count+count, (i+1) % count) for i in range(count)]
    mesh = bpy.data.meshes.new("薄纸卡 · 0.6毫米微圆角")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    old_mesh = card.data
    card.data = mesh
    if not old_mesh.users:
        bpy.data.meshes.remove(old_mesh)
    card.name = "主体平面 · 微圆角珠光纸卡"
    card.rotation_euler = (math.pi/2, 0, 0)
    card.location = (0, 0, 0)
    card.scale = (1, 1, 1)
    card.modifiers.clear()
    uv = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        polygon.material_index = 0 if polygon.index == 0 else 2 if polygon.index == 1 else 1
        for corner_index, loop_index in enumerate(polygon.loop_indices):
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv = (
                (co.x/w+.5, co.y/h+.5) if polygon.index < 2
                else [(0, 0), (0, 1), (1, 1), (1, 0)][corner_index]
            )

    def material(name, color, roughness):
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.node_tree.nodes.clear()
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        output = nodes.new("ShaderNodeOutputMaterial")
        output.location = (650, 100)
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.location = (340, 100)
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Metallic"].default_value = 0
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["IOR"].default_value = 1.48
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
        return mat, nodes, links, bsdf

    front, nodes, links, bsdf = material("01 · 固定印刷 / 细涂布纸", (.95, .94, .91), .34)
    tex = nodes.new("ShaderNodeTexImage")
    tex.label = "完整原画 · 固定 UV"
    tex.location = (-600, 300)
    tex.image = bpy.data.images.load(str(PROJECT / "assets/subject.png"), check_existing=True)
    tex.image.filepath = "//assets/subject.png"
    tex.image.pack()
    coord = nodes.new("ShaderNodeTexCoord")
    coord.location = (-850, 50)
    links.new(coord.outputs["UV"], tex.inputs["Vector"])
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Coat Weight"].default_value = .18
    bsdf.inputs["Coat Roughness"].default_value = .23
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-580, -120)
    noise.label = "涂布纸微纹理"
    noise.inputs["Scale"].default_value = 650
    noise.inputs["Detail"].default_value = 1
    links.new(coord.outputs["UV"], noise.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.location = (70, -120)
    bump.inputs["Strength"].default_value = .1
    bump.inputs["Distance"].default_value = .005
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    # Preserve the colorful foil as a view-dependent reflection over the print.
    facing = nodes.new("ShaderNodeLayerWeight")
    facing.location = (-550, -400)
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.location = (-310, -400)
    ramp.label = "珠光镭射 · 随角度变色"
    colors = [
        (0, (.8, .3, .65, 1)), (.25, (.35, .75, .9, 1)),
        (.5, (.9, .8, .3, 1)), (.75, (.7, .4, .8, 1)),
        (1, (.55, .85, .75, 1)),
    ]
    for index, (position, color) in enumerate(colors):
        element = ramp.color_ramp.elements[index] if index < 2 else ramp.color_ramp.elements.new(position)
        element.position, element.color = position, color
    links.new(facing.outputs["Facing"], ramp.inputs["Fac"])
    foil = nodes.new("ShaderNodeBsdfPrincipled")
    foil.location = (340, -500)
    foil.inputs["Metallic"].default_value = 1
    foil.inputs["Roughness"].default_value = .34
    links.new(ramp.outputs["Color"], foil.inputs["Base Color"])
    links.new(bump.outputs["Normal"], foil.inputs["Normal"])
    mix = nodes.new("ShaderNodeMixShader")
    mix.location = (650, -100)
    mix.inputs[0].default_value = .16
    links.new(bsdf.outputs["BSDF"], mix.inputs[1])
    links.new(foil.outputs["BSDF"], mix.inputs[2])
    output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
    output.location = (890, 100)
    links.new(mix.outputs[0], output.inputs["Surface"])
    edge, *_ = material("03 · 暖白切边 / 非金属纸芯", (.81, .79, .74), .85)
    back, *_ = material("05 · 纸卡背面", (.87, .85, .81), .75)
    for mat in (front, edge, back):
        mesh.materials.append(mat)
    assert len(mesh.vertices) == len({tuple(v.co) for v in mesh.vertices}) == count*2
    assert len(mesh.polygons) == count+2 and all(p.area > 0 for p in mesh.polygons)
    assert len(mesh.edges) == count*3
    scene.frame_set(1)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    bpy.ops.wm.save_as_mainfile(filepath=str(PROJECT / "card.blend"))

    if "--render" in sys.argv:
        for name, angle in [("hero", 0), ("left", -.32), ("right", .32)]:
            pivot.rotation_euler = (0, 0, angle)
            scene.render.filepath = str(PROJECT / f"renders/{name}.png")
            bpy.ops.render.render(write_still=True)
    pivot.rotation_euler = (0, 0, 0)

    # Save the editable paper materials above; only the export gets role names.
    indices = [p.material_index for p in mesh.polygons]
    mesh.materials.clear()
    for role in ("front", "edge", "back"):
        mat, *_ = material(f"web_{role}", (.85, .83, .79), .85)
        mesh.materials.append(mat)
    for polygon, index in zip(mesh.polygons, indices):
        polygon.material_index = index
    bpy.ops.object.select_all(action="DESELECT")
    card.select_set(True)
    pivot.select_set(True)
    output = PROJECT / "web/assets/card.glb"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True,
        export_materials="EXPORT", export_animations=False,
        export_cameras=False, export_lights=False, export_yup=True,
    )
    shutil.copyfile(output, SITE / "public/assets/flash-cards/card.glb")
    report = {
        "blender": bpy.app.version_string, "vertices": count*2, "edges": count*3, "faces": count+2,
        "dimensionsCm": [w, h, thickness], "thicknessMm": round(thickness * 10, 2),
        "cornerRadiusMm": radius*10, "fixedPrintUV": True, "edgeMetallic": 0,
        "objectRotationDegrees": [90, 0, 0],
        "materialRoles": ["web_front", "web_edge", "web_back"],
    }
    (PROJECT / "verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    rebuild() if "--blender-job" in sys.argv else launch()
