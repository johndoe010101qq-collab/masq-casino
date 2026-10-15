MASQ Plinko film calibration, v47

Source: user-supplied masq-anonymous-classic-games-preview-v1.zip.
The two layout files and eight action-mark files are copied unchanged.
The idle MP4 files are copied unchanged. Action atlases contain one complete
host and surrounding scene crop, never independently pasted body parts.
Atlases are lossless WebP derivatives of the decoded supplied H.264 clips.
Desktop crop: x680 y0 width560 height400, five columns, seven rows.
Mobile crop: x126 y42 width468 height334, five columns, seven rows.
Each action has 34 frames at 30fps; the last atlas cell is unused.

Verified: all eight desktop/mobile hand-track handoffs at frame19 match the
corresponding after-clip frame0 exactly. The delivered raw-render check reports
pixel identity. The independently encoded H.264 footage is not pixel-identical:
desktop drop_left frame19 versus drop_right_after_left frame0 has mean absolute
RGB channel difference0.24434 and maximum48/255 after decoding. Lossless WebP
does not erase that inherited difference.

Runtime visuals use the authored native hand tracks and label/landing anchors.
The ball radius is the supplied suggested radius. Ball contacts account for
the square cap half-width. The feed tube's JSON exit is behind the pin plane;
the runtime reveals the emerging ball at the visible front edge above the
first pin, so the full sphere is never drawn penetrating that pin cap.

Fast accepted launches share a whole-character gesture. When a new launch
arrives between release17 and handoff19, the next after-clip starts at19.
If that boundary has passed, the current full action completes first. This
is only a gesture schedule: accepted balls have no admission limit or queue.
All retain the existing financial controller deadline; short deadlines and
unavailable media use a visual nozzle fallback. Media never settles money.

No layout-guide annotations or demo overlay video are used as app footage.
