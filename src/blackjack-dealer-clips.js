// Verified 1920 × 1080, 30 fps dealer pack. Marks use exact 0-based frame
// positions, rather than the rounded durations in its descriptive README.
// This presentation-only module consumes public snapshots and elapsed time.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const BLACKJACK_DEALER_CLIPS = freeze({
  "idle": {
    "id": "idle",
    "src": "/blackjack-dealer-v35/idle.mp4",
    "fps": 30,
    "frames": 300,
    "durationMs": 10000.0,
    "loop": true,
    "marks": {}
  },
  "deal_player": {
    "id": "deal_player",
    "src": "/blackjack-dealer-v35/deal_player.mp4",
    "fps": 30,
    "frames": 40,
    "durationMs": 1333.3333333333333,
    "loop": false,
    "marks": {
      "take": {
        "frame": 9,
        "timeMs": 300.0,
        "hand": "L",
        "screenPx": [
          1159,
          530
        ]
      },
      "release": {
        "frame": 21,
        "timeMs": 700.0,
        "hand": "L",
        "screenPx": [
          1022,
          551
        ]
      }
    }
  },
  "deal_dealer": {
    "id": "deal_dealer",
    "src": "/blackjack-dealer-v35/deal_dealer.mp4",
    "fps": 30,
    "frames": 40,
    "durationMs": 1333.3333333333333,
    "loop": false,
    "marks": {
      "take": {
        "frame": 9,
        "timeMs": 300.0,
        "hand": "L",
        "screenPx": [
          1159,
          530
        ]
      },
      "release": {
        "frame": 22,
        "timeMs": 733.3333333333333,
        "hand": "L",
        "screenPx": [
          1025,
          544
        ]
      }
    }
  },
  "reveal": {
    "id": "reveal",
    "src": "/blackjack-dealer-v35/reveal.mp4",
    "fps": 30,
    "frames": 45,
    "durationMs": 1500.0,
    "loop": false,
    "marks": {
      "grip": {
        "frame": 13,
        "timeMs": 433.33333333333337,
        "hand": "R",
        "screenPx": [
          906,
          536
        ]
      },
      "reveal": {
        "frame": 18,
        "timeMs": 600.0,
        "hand": "R",
        "screenPx": [
          848,
          508
        ]
      },
      "glance": {
        "frame": 30,
        "timeMs": 1000.0,
        "hand": "R",
        "screenPx": [
          821,
          545
        ]
      }
    }
  },
  "lose_laugh": {
    "id": "lose_laugh",
    "src": "/blackjack-dealer-v35/lose_laugh.mp4",
    "fps": 30,
    "frames": 79,
    "durationMs": 2633.3333333333335,
    "loop": false,
    "marks": {
      "hand_to_mouth": {
        "frame": 17,
        "timeMs": 566.6666666666666,
        "hand": "R",
        "screenPx": [
          934,
          350
        ]
      },
      "chuckle_peak": {
        "frame": 23,
        "timeMs": 766.6666666666667,
        "hand": "R",
        "screenPx": [
          934,
          351
        ]
      },
      "hand_down": {
        "frame": 50,
        "timeMs": 1666.6666666666667,
        "hand": "R",
        "screenPx": [
          934,
          356
        ]
      }
    }
  },
  "player_bust": {
    "id": "player_bust",
    "src": "/blackjack-dealer-v35/player_bust.mp4",
    "fps": 30,
    "frames": 79,
    "durationMs": 2633.3333333333335,
    "loop": false,
    "marks": {
      "look_at_cards": {
        "frame": 11,
        "timeMs": 366.66666666666663,
        "hand": "R",
        "screenPx": [
          841,
          546
        ]
      },
      "shake": {
        "frame": 19,
        "timeMs": 633.3333333333333,
        "hand": "R",
        "screenPx": [
          841,
          545
        ]
      },
      "mock_wave": {
        "frame": 48,
        "timeMs": 1600.0,
        "hand": "R",
        "screenPx": [
          774,
          410
        ]
      }
    }
  },
  "player_win": {
    "id": "player_win",
    "src": "/blackjack-dealer-v35/player_win.mp4",
    "fps": 30,
    "frames": 73,
    "durationMs": 2433.333333333333,
    "loop": false,
    "marks": {
      "surprise": {
        "frame": 9,
        "timeMs": 300.0,
        "hand": "both",
        "screenPx": {
          "R": [
            816,
            527
          ],
          "L": [
            1104,
            527
          ]
        }
      },
      "nod": {
        "frame": 36,
        "timeMs": 1200.0,
        "hand": "R",
        "screenPx": [
          840,
          546
        ]
      }
    }
  },
  "big_win": {
    "id": "big_win",
    "src": "/blackjack-dealer-v35/big_win.mp4",
    "fps": 30,
    "frames": 109,
    "durationMs": 3633.3333333333335,
    "loop": false,
    "marks": {
      "arms_spread": {
        "frame": 21,
        "timeMs": 700.0,
        "hand": "both",
        "screenPx": {
          "R": [
            695,
            392
          ],
          "L": [
            1225,
            392
          ]
        }
      },
      "clap_1": {
        "frame": 65,
        "timeMs": 2166.6666666666665,
        "hand": "both",
        "screenPx": {
          "R": [
            933,
            502
          ],
          "L": [
            987,
            502
          ]
        }
      },
      "clap_2": {
        "frame": 74,
        "timeMs": 2466.666666666667,
        "hand": "both",
        "screenPx": {
          "R": [
            933,
            502
          ],
          "L": [
            987,
            502
          ]
        }
      },
      "acknowledge": {
        "frame": 87,
        "timeMs": 2900.0,
        "hand": "R",
        "screenPx": [
          868,
          537
        ]
      }
    }
  },
  "push": {
    "id": "push",
    "src": "/blackjack-dealer-v35/push.mp4",
    "fps": 30,
    "frames": 55,
    "durationMs": 1833.3333333333333,
    "loop": false,
    "marks": {
      "shrug": {
        "frame": 15,
        "timeMs": 500.0,
        "hand": "both",
        "screenPx": {
          "R": [
            795,
            523
          ],
          "L": [
            1125,
            523
          ]
        }
      }
    }
  }
});

export const BLACKJACK_DEALER_PRESENTATION_TIMING = freeze({
  dealPlayerMs: BLACKJACK_DEALER_CLIPS.deal_player.durationMs,
  dealDealerMs: BLACKJACK_DEALER_CLIPS.deal_dealer.durationMs,
  revealMs: BLACKJACK_DEALER_CLIPS.reveal.durationMs,
  revealAtMs: BLACKJACK_DEALER_CLIPS.reveal.marks.reveal.timeMs,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const elapsed = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const smooth = value => value * value * (3 - 2 * value);

/** Only an explicitly public, settled result can choose an outcome reaction. */
export function selectBlackjackDealerClip({ view, motion, status = 'idle',
  settled = Boolean(view?.result) } = {}) {
  if (status === 'resolved' && settled && view?.revealed && view?.result) {
    switch (view.result.outcome) {
      case 'blackjack': return 'big_win';
      case 'win': return 'player_win';
      case 'push': return 'push';
      case 'lose': return view.playerTotal > 21 ? 'player_bust' : 'lose_laugh';
      default: return 'idle';
    }
  }
  if (motion?.kind === 'deal') {
    return motion.side === 'player' ? 'deal_player' : motion.side === 'dealer' ? 'deal_dealer' : 'idle';
  }
  return motion?.kind === 'flip' ? 'reveal' : 'idle';
}

/** Linear interpolation between exact frame-indexed native screen hand tips. */
export function blackjackDealerHandAt(clipId, timeMs, hand = 'L') {
  const track = handTracks[clipId];
  if (!track) throw new RangeError('Dealer hand tracking is unavailable for this clip.');
  if (hand !== 'L' && hand !== 'R') throw new RangeError('Dealer hand must be L or R.');
  const frame = clamp(elapsed(timeMs) * 30 / 1000, 0, track.length - 1);
  const index = Math.floor(frame), next = Math.min(index + 1, track.length - 1);
  const fraction = frame - index, offset = hand === 'R' ? 0 : 2;
  return freeze({
    x: track[index][offset] + (track[next][offset] - track[index][offset]) * fraction,
    y: track[index][offset + 1] + (track[next][offset + 1] - track[index][offset + 1]) * fraction,
  });
}

/** The app card first follows the empty hand, then lands on the existing felt. */
export function blackjackDealerDealPose(side, timeMs) {
  if (side !== 'player' && side !== 'dealer') throw new RangeError('Card side must be player or dealer.');
  const clipId = side === 'player' ? 'deal_player' : 'deal_dealer';
  const clip = BLACKJACK_DEALER_CLIPS[clipId];
  const takeMs = clip.marks.take.timeMs, releaseMs = clip.marks.release.timeMs;
  const landMs = releaseMs + (side === 'player' ? 350 : 300);
  const time = elapsed(timeMs);
  const stage = time < takeMs ? 'waiting' : time < releaseMs ? 'carried' : time < landMs ? 'flying' : 'landed';
  return freeze({
    stage, visible: time >= takeMs, takeMs, releaseMs, landMs,
    origin: blackjackDealerHandAt(clipId, Math.min(time, releaseMs), 'L'),
    flightProgress: clamp((time - releaseMs) / (landMs - releaseMs), 0, 1),
  });
}

/** The face crosses its edge at the same 600 ms as the public reveal. */
export function blackjackDealerRevealPose(timeMs) {
  const gripMs = BLACKJACK_DEALER_CLIPS.reveal.marks.grip.timeMs;
  const revealMs = BLACKJACK_DEALER_CLIPS.reveal.marks.reveal.timeMs;
  const endMs = 23 / 30 * 1000;
  const time = elapsed(timeMs);
  const faceProgress = time <= revealMs
    ? .5 * smooth(clamp((time - gripMs) / (revealMs - gripMs), 0, 1))
    : .5 + .5 * smooth(clamp((time - revealMs) / (endMs - revealMs), 0, 1));
  return freeze({ faceProgress, gripMs, revealMs, endMs });
}

const handTracks = freeze({
  "deal_player": [[840,545,1080,545],[840,545,1083,545],[840,545,1091,544],[840,546,1103,543],[841,547,1116,542],[841,548,1130,541],[841,547,1141,538],[841,547,1151,534],[841,547,1157,531],[841,547,1159,530],[841,547,1156,531],[841,547,1149,535],[841,547,1139,539],[841,547,1127,542],[841,547,1116,544],[841,547,1101,545],[841,547,1083,546],[841,547,1065,547],[841,546,1048,549],[841,545,1034,550],[841,544,1026,550],[841,543,1022,551],[841,543,1023,551],[841,543,1023,549],[841,543,1024,545],[841,543,1025,541],[841,543,1027,540],[841,544,1030,541],[841,544,1034,542],[841,545,1038,544],[841,545,1043,546],[841,546,1048,546],[841,546,1053,546],[841,545,1059,546],[841,545,1064,545],[840,545,1069,545],[840,545,1073,545],[840,545,1077,545],[840,545,1079,545],[840,545,1080,545]],
  "deal_dealer": [[840,545,1080,545],[840,545,1083,545],[840,545,1091,544],[840,546,1103,543],[841,547,1116,542],[841,548,1130,541],[841,547,1142,538],[841,547,1151,534],[841,547,1157,531],[841,547,1159,530],[841,547,1156,531],[841,547,1148,534],[841,547,1138,538],[841,547,1127,540],[841,547,1116,541],[841,547,1103,541],[841,547,1088,539],[841,547,1072,537],[841,547,1056,534],[841,547,1042,534],[841,547,1032,542],[841,547,1026,544],[841,547,1025,544],[841,547,1025,545],[841,548,1025,544],[841,547,1026,545],[841,547,1028,545],[840,546,1030,541],[840,546,1033,538],[840,546,1037,538],[840,545,1041,540],[840,545,1046,542],[840,545,1051,544],[840,545,1057,545],[840,545,1062,545],[840,545,1068,545],[840,545,1072,545],[840,545,1076,545],[840,545,1079,545],[840,545,1080,545]],
  "reveal": [[840,545,1080,545],[843,545,1080,545],[850,545,1080,545],[859,544,1080,546],[871,544,1079,546],[882,542,1079,547],[893,541,1079,547],[901,540,1079,547],[907,539,1079,547],[910,538,1079,547],[910,537,1079,547],[909,537,1079,547],[908,536,1079,547],[906,536,1079,547],[901,536,1079,547],[891,532,1079,547],[877,521,1079,547],[862,511,1079,547],[848,508,1079,547],[835,513,1079,547],[821,525,1079,547],[807,538,1079,547],[797,541,1079,547],[792,541,1079,547],[794,542,1079,547],[799,542,1079,548],[807,543,1079,547],[813,544,1079,547],[816,544,1079,546],[819,545,1079,546],[821,545,1079,546],[823,545,1079,546],[826,545,1079,546],[828,545,1080,546],[830,545,1080,546],[832,545,1080,546],[834,545,1080,546],[835,545,1080,546],[837,545,1080,545],[838,545,1080,545],[839,545,1080,545],[840,545,1080,545],[840,545,1080,545],[840,545,1080,545],[840,545,1080,545]]
});
