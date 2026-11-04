# Roxy DragonBones rig (run 2) - replaces roxyrig/rigChalet.ts (mesh rig + Graphics eyelids)
Files: roxy_ske.json, roxy_tex.json, roxy_tex.png/.webp (one 2048 page), runtime: pixi-dragonbones-runtime 8.0.3 (MIT, RUNTIME_LICENSE.txt).
Source art: approved still roxy_still_A -> game/roxy_base_2x.png (852x1728) + painted faces/2x. Armature origin = canvas 0,0 (852x1728); pivot_feet [373.2,1698] in userData.
Bones: pelvis>spine>chest>neck>head>pony1-3; chest>uarm>farm>door_hand; pelvis>thighL/shinL, thighR/shinR; ground (feet pinned, root level).
Slots: roxy_body (weighted mesh, 1426 v, 8442 floats < 32767), face (displays 0 blink,1 smile,2 excited,3 disappointed,4 eager; -1 = painted rest face, eyes OPEN), face_eye (0 wink_eye, layered on excited for the wink).
Body animations (60 fps; play on group 'body', 0.25 s fades between them):
- idle (4 s loop): breath, sway, head tilt, ponytail follow-through. Resting hand (finger at lips) follows the head (slide <=1 px).
- win (2 s, once): rigid hop (pelvis+ground lift together, no stretch), arm lift, hair follow-through; ends on rest pose.
- intro_door (1.5 s, hold last frame): door-sill stance, hand reaches toward the lever. Read bone 'door_hand' global position each frame for holdL()/doorPts() (replaces doorReach()).
- intro_step (0.58 s): steps forward (+40 px, arc) with the camera push T.push 1.55-2.13.
- intro_land (0.67 s): drops onto the log (from -70 px), hair settles, ENDS on the setup pose; fade 0.25 s into idle.
Face animations (group 'face', resetToPose=false, fadeIn(name,0,1,1,'face')): blink (7 fr), wink (0.7 s, start at T.wink[0]=0.75), laugh (excited, eyes open, wins only), smile, disappointed (miss), eager (anticipation).
Code mapping from rigChalet API: face('wink')->wink; face('closed')->blink; win('bonus')->win + laugh; win('win')->win + smile then wink; miss->disappointed; doorPts()->door_hand bone + chest bone (sh).
Skip intro = fadeIn('idle',0) + clear face group. Landscape + portrait: same rig, scale by container (no per-orientation data).
lid_L/lid_R (run 1 carry-over): retired - painted blink/wink face frames replace code eyelids.
