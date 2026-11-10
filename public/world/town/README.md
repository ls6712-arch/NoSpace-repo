# Town characters

People and dogs for the 3D town behind every page (`src/app/world/town.ts`,
`townCast.ts`). All models are by Quaternius, released under CC0 (public
domain); see `LICENSE-quaternius.txt`.

| File | Source pack |
| --- | --- |
| `casual*-*.glb`, `oldclassy-*.glb` | Ultimate Animated Character Pack, meshes only |
| `people-moves.glb` | Same pack: the shared skeleton with Idle, Walk, Run, SitDown and Victory |
| `shiba.glb`, `husky.glb` | Ultimate Animated Animals: Idle, Walk, Gallop, Idle_2_HeadLow, Eating |

Processed with glTF Transform: unused animations removed, meshes welded and
simplified, then quantized (KHR_mesh_quantization). No Draco or meshopt
compression, because both decode with WebAssembly and the site's
Content-Security-Policy does not allow it. Vercel compresses the files in
transit (about 860 KB for the whole set).

Soosh's own look (clothes in the Soosh palette, skin tones, the Stub badge,
the dogs' bandanas) is applied in code, in `townCast.ts`, not baked into the
files, so it can change without touching the models.
