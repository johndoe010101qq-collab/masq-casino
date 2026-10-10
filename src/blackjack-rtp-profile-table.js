// Generated only after all46 frozen presets completed independent actual-engine holdout.
export default {
  "version": "indictus-blackjack-public-50-95-v2",
  "engineSHA256": "97d324d46535194515b982f343e5a28c1ce090f7c4e12fd33c3d5c8ecdad9e5e",
  "paramsSHA256": "02a731477052ff64a6d0b3a2926a2d8e90955b0e82e58eb4a27487450803d7e2",
  "policy": "Standard six-deck S17 hit/stand. Hard12 stands vs4–6; hard13–16 stands vs2–6; hard17+ stands. Soft18 stands vs2–8; soft19+ stands. Only visible player cards and dealer upcard; no doubles, splits, surrender or insurance.",
  "method": "Analytic infinite-deck public-bias pilot; distribution-equivalent finite six-deck rank-count calibration with at least1000000hands per preset and disjoint SHA256-seeded sfc32 streams. Parameter table frozen before separate100000-hand holdout per preset on unchanged physical312-card blackjack.js engine. Rejection sampling for unbiased integer tickets. No failures retried, no bankroll stops, no post-result payout changes.",
  "limitation": "Every Blackjack RTP is approximate and strategy dependent. Profile70 deliberately retains the native3200/1500 ticket rules; its independently measured basic return is about70.95%, not exactly70%. Physical six-deck312-card engine and payouts are unchanged.",
  "profiles": {
    "rtp50": {
      "id": "rtp50",
      "targetReturnPercent": 50,
      "dealerBoostTickets": 6533,
      "playerUnfavorableTickets": 3063,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:50",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 49.8245,
          "return95CI_Percent": [
            49.29484223941206,
            50.35415776058794
          ],
          "outcomes": {
            "blackjack": 4601,
            "win": 15386,
            "push": 7550,
            "lose": 72463
          }
        }
      }
    },
    "rtp51": {
      "id": "rtp51",
      "targetReturnPercent": 51,
      "dealerBoostTickets": 6349,
      "playerUnfavorableTickets": 2976,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:51",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 51.028,
          "return95CI_Percent": [
            50.49458221783375,
            51.56141778216624
          ],
          "outcomes": {
            "blackjack": 4502,
            "win": 16097,
            "push": 7579,
            "lose": 71822
          }
        }
      }
    },
    "rtp52": {
      "id": "rtp52",
      "targetReturnPercent": 52,
      "dealerBoostTickets": 6168,
      "playerUnfavorableTickets": 2891,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:52",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 52.047,
          "return95CI_Percent": [
            51.51079455570291,
            52.583205444297086
          ],
          "outcomes": {
            "blackjack": 4560,
            "win": 16392,
            "push": 7863,
            "lose": 71185
          }
        }
      }
    },
    "rtp53": {
      "id": "rtp53",
      "targetReturnPercent": 53,
      "dealerBoostTickets": 5990,
      "playerUnfavorableTickets": 2808,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:53",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 53.080000000000005,
          "return95CI_Percent": [
            52.54009952715079,
            53.619900472849224
          ],
          "outcomes": {
            "blackjack": 4512,
            "win": 17026,
            "push": 7748,
            "lose": 70714
          }
        }
      }
    },
    "rtp54": {
      "id": "rtp54",
      "targetReturnPercent": 54,
      "dealerBoostTickets": 5816,
      "playerUnfavorableTickets": 2726,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:54",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 53.87499999999999,
          "return95CI_Percent": [
            53.33290811702618,
            54.417091882973814
          ],
          "outcomes": {
            "blackjack": 4534,
            "win": 17321,
            "push": 7898,
            "lose": 70247
          }
        }
      }
    },
    "rtp55": {
      "id": "rtp55",
      "targetReturnPercent": 55,
      "dealerBoostTickets": 5668,
      "playerUnfavorableTickets": 2657,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:55",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 55.3605,
          "return95CI_Percent": [
            54.812257893753944,
            55.90874210624606
          ],
          "outcomes": {
            "blackjack": 4699,
            "win": 17953,
            "push": 7707,
            "lose": 69641
          }
        }
      }
    },
    "rtp56": {
      "id": "rtp56",
      "targetReturnPercent": 56,
      "dealerBoostTickets": 5494,
      "playerUnfavorableTickets": 2575,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:56",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 55.791000000000004,
          "return95CI_Percent": [
            55.24297430881364,
            56.339025691186364
          ],
          "outcomes": {
            "blackjack": 4434,
            "win": 18443,
            "push": 7820,
            "lose": 69303
          }
        }
      }
    },
    "rtp57": {
      "id": "rtp57",
      "targetReturnPercent": 57,
      "dealerBoostTickets": 5307,
      "playerUnfavorableTickets": 2488,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:57",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 56.8575,
          "return95CI_Percent": [
            56.306033219322146,
            57.40896678067786
          ],
          "outcomes": {
            "blackjack": 4475,
            "win": 18926,
            "push": 7818,
            "lose": 68781
          }
        }
      }
    },
    "rtp58": {
      "id": "rtp58",
      "targetReturnPercent": 58,
      "dealerBoostTickets": 5169,
      "playerUnfavorableTickets": 2423,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:58",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 57.852000000000004,
          "return95CI_Percent": [
            57.29710962573027,
            58.406890374269736
          ],
          "outcomes": {
            "blackjack": 4506,
            "win": 19434,
            "push": 7719,
            "lose": 68341
          }
        }
      }
    },
    "rtp59": {
      "id": "rtp59",
      "targetReturnPercent": 59,
      "dealerBoostTickets": 4981,
      "playerUnfavorableTickets": 2335,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:59",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 59.426500000000004,
          "return95CI_Percent": [
            58.86792932119275,
            59.98507067880726
          ],
          "outcomes": {
            "blackjack": 4519,
            "win": 20079,
            "push": 7971,
            "lose": 67431
          }
        }
      }
    },
    "rtp60": {
      "id": "rtp60",
      "targetReturnPercent": 60,
      "dealerBoostTickets": 4821,
      "playerUnfavorableTickets": 2260,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:60",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 59.957499999999996,
          "return95CI_Percent": [
            59.39725687979713,
            60.51774312020286
          ],
          "outcomes": {
            "blackjack": 4439,
            "win": 20524,
            "push": 7812,
            "lose": 67225
          }
        }
      }
    },
    "rtp61": {
      "id": "rtp61",
      "targetReturnPercent": 61,
      "dealerBoostTickets": 4664,
      "playerUnfavorableTickets": 2186,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:61",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 60.8635,
          "return95CI_Percent": [
            60.30044955134593,
            61.42655044865408
          ],
          "outcomes": {
            "blackjack": 4577,
            "win": 20770,
            "push": 7881,
            "lose": 66772
          }
        }
      }
    },
    "rtp62": {
      "id": "rtp62",
      "targetReturnPercent": 62,
      "dealerBoostTickets": 4509,
      "playerUnfavorableTickets": 2113,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:62",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 61.9775,
          "return95CI_Percent": [
            61.41224138028246,
            62.54275861971753
          ],
          "outcomes": {
            "blackjack": 4421,
            "win": 21514,
            "push": 7897,
            "lose": 66168
          }
        }
      }
    },
    "rtp63": {
      "id": "rtp63",
      "targetReturnPercent": 63,
      "dealerBoostTickets": 4355,
      "playerUnfavorableTickets": 2042,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:63",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 63.29050000000001,
          "return95CI_Percent": [
            62.72159765573087,
            63.85940234426914
          ],
          "outcomes": {
            "blackjack": 4543,
            "win": 21989,
            "push": 7955,
            "lose": 65513
          }
        }
      }
    },
    "rtp64": {
      "id": "rtp64",
      "targetReturnPercent": 64,
      "dealerBoostTickets": 4241,
      "playerUnfavorableTickets": 1988,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:64",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 63.83,
          "return95CI_Percent": [
            63.259765772328294,
            64.4002342276717
          ],
          "outcomes": {
            "blackjack": 4594,
            "win": 22164,
            "push": 8017,
            "lose": 65225
          }
        }
      }
    },
    "rtp65": {
      "id": "rtp65",
      "targetReturnPercent": 65,
      "dealerBoostTickets": 4055,
      "playerUnfavorableTickets": 1901,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:65",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 65.315,
          "return95CI_Percent": [
            64.74131612110473,
            65.88868387889526
          ],
          "outcomes": {
            "blackjack": 4578,
            "win": 22924,
            "push": 8022,
            "lose": 64476
          }
        }
      }
    },
    "rtp66": {
      "id": "rtp66",
      "targetReturnPercent": 66,
      "dealerBoostTickets": 3908,
      "playerUnfavorableTickets": 1832,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:66",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 65.837,
          "return95CI_Percent": [
            65.26266564112805,
            66.41133435887195
          ],
          "outcomes": {
            "blackjack": 4462,
            "win": 23320,
            "push": 8042,
            "lose": 64176
          }
        }
      }
    },
    "rtp67": {
      "id": "rtp67",
      "targetReturnPercent": 67,
      "dealerBoostTickets": 3763,
      "playerUnfavorableTickets": 1764,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:67",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 66.9235,
          "return95CI_Percent": [
            66.34615749087766,
            67.50084250912235
          ],
          "outcomes": {
            "blackjack": 4575,
            "win": 23737,
            "push": 8012,
            "lose": 63676
          }
        }
      }
    },
    "rtp68": {
      "id": "rtp68",
      "targetReturnPercent": 68,
      "dealerBoostTickets": 3652,
      "playerUnfavorableTickets": 1712,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:68",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 68.0275,
          "return95CI_Percent": [
            67.44867674176693,
            68.60632325823306
          ],
          "outcomes": {
            "blackjack": 4529,
            "win": 24239,
            "push": 8227,
            "lose": 63005
          }
        }
      }
    },
    "rtp69": {
      "id": "rtp69",
      "targetReturnPercent": 69,
      "dealerBoostTickets": 3477,
      "playerUnfavorableTickets": 1630,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:69",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 68.6135,
          "return95CI_Percent": [
            68.03383848842782,
            69.1931615115722
          ],
          "outcomes": {
            "blackjack": 4387,
            "win": 24739,
            "push": 8168,
            "lose": 62706
          }
        }
      }
    },
    "rtp70": {
      "id": "rtp70",
      "targetReturnPercent": 70,
      "dealerBoostTickets": 3200,
      "playerUnfavorableTickets": 1500,
      "nativeLegacy": true,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:70",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 70.9075,
          "return95CI_Percent": [
            70.32345485230125,
            71.49154514769874
          ],
          "outcomes": {
            "blackjack": 4473,
            "win": 25695,
            "push": 8335,
            "lose": 61497
          }
        }
      }
    },
    "rtp71": {
      "id": "rtp71",
      "targetReturnPercent": 71,
      "dealerBoostTickets": 3199,
      "playerUnfavorableTickets": 1499,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:71",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 70.91499999999999,
          "return95CI_Percent": [
            70.3305681713236,
            71.49943182867638
          ],
          "outcomes": {
            "blackjack": 4470,
            "win": 25761,
            "push": 8218,
            "lose": 61551
          }
        }
      }
    },
    "rtp72": {
      "id": "rtp72",
      "targetReturnPercent": 72,
      "dealerBoostTickets": 3062,
      "playerUnfavorableTickets": 1435,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:72",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 71.5345,
          "return95CI_Percent": [
            70.94878360038636,
            72.12021639961364
          ],
          "outcomes": {
            "blackjack": 4477,
            "win": 26075,
            "push": 8192,
            "lose": 61256
          }
        }
      }
    },
    "rtp73": {
      "id": "rtp73",
      "targetReturnPercent": 73,
      "dealerBoostTickets": 2927,
      "playerUnfavorableTickets": 1372,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:73",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 73.354,
          "return95CI_Percent": [
            72.76510460377548,
            73.9428953962245
          ],
          "outcomes": {
            "blackjack": 4514,
            "win": 26900,
            "push": 8269,
            "lose": 60317
          }
        }
      }
    },
    "rtp74": {
      "id": "rtp74",
      "targetReturnPercent": 74,
      "dealerBoostTickets": 2793,
      "playerUnfavorableTickets": 1309,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:74",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 74.016,
          "return95CI_Percent": [
            73.42587324787523,
            74.60612675212478
          ],
          "outcomes": {
            "blackjack": 4484,
            "win": 27302,
            "push": 8202,
            "lose": 60012
          }
        }
      }
    },
    "rtp75": {
      "id": "rtp75",
      "targetReturnPercent": 75,
      "dealerBoostTickets": 2681,
      "playerUnfavorableTickets": 1257,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:75",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 74.632,
          "return95CI_Percent": [
            74.041254068013,
            75.22274593198699
          ],
          "outcomes": {
            "blackjack": 4460,
            "win": 27592,
            "push": 8298,
            "lose": 59650
          }
        }
      }
    },
    "rtp76": {
      "id": "rtp76",
      "targetReturnPercent": 76,
      "dealerBoostTickets": 2530,
      "playerUnfavorableTickets": 1186,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:76",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 75.986,
          "return95CI_Percent": [
            75.39289126030867,
            76.57910873969132
          ],
          "outcomes": {
            "blackjack": 4598,
            "win": 28040,
            "push": 8411,
            "lose": 58951
          }
        }
      }
    },
    "rtp77": {
      "id": "rtp77",
      "targetReturnPercent": 77,
      "dealerBoostTickets": 2400,
      "playerUnfavorableTickets": 1125,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:77",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 76.9815,
          "return95CI_Percent": [
            76.38763728895871,
            77.5753627110413
          ],
          "outcomes": {
            "blackjack": 4461,
            "win": 28677,
            "push": 8475,
            "lose": 58387
          }
        }
      }
    },
    "rtp78": {
      "id": "rtp78",
      "targetReturnPercent": 78,
      "dealerBoostTickets": 2289,
      "playerUnfavorableTickets": 1073,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:78",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 78.5215,
          "return95CI_Percent": [
            77.92518013498793,
            79.11781986501208
          ],
          "outcomes": {
            "blackjack": 4541,
            "win": 29335,
            "push": 8499,
            "lose": 57625
          }
        }
      }
    },
    "rtp79": {
      "id": "rtp79",
      "targetReturnPercent": 79,
      "dealerBoostTickets": 2146,
      "playerUnfavorableTickets": 1006,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:79",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 79.13550000000001,
          "return95CI_Percent": [
            78.53755572575515,
            79.73344427424485
          ],
          "outcomes": {
            "blackjack": 4577,
            "win": 29697,
            "push": 8299,
            "lose": 57427
          }
        }
      }
    },
    "rtp80": {
      "id": "rtp80",
      "targetReturnPercent": 80,
      "dealerBoostTickets": 2039,
      "playerUnfavorableTickets": 956,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:80",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 79.565,
          "return95CI_Percent": [
            78.96728663914463,
            80.16271336085536
          ],
          "outcomes": {
            "blackjack": 4512,
            "win": 29909,
            "push": 8467,
            "lose": 57112
          }
        }
      }
    },
    "rtp81": {
      "id": "rtp81",
      "targetReturnPercent": 81,
      "dealerBoostTickets": 1913,
      "playerUnfavorableTickets": 897,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:81",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 80.5925,
          "return95CI_Percent": [
            79.99337710200196,
            81.19162289799804
          ],
          "outcomes": {
            "blackjack": 4547,
            "win": 30372,
            "push": 8481,
            "lose": 56600
          }
        }
      }
    },
    "rtp82": {
      "id": "rtp82",
      "targetReturnPercent": 82,
      "dealerBoostTickets": 1773,
      "playerUnfavorableTickets": 831,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:82",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 81.441,
          "return95CI_Percent": [
            80.8405611939477,
            82.0414388060523
          ],
          "outcomes": {
            "blackjack": 4454,
            "win": 31015,
            "push": 8276,
            "lose": 56255
          }
        }
      }
    },
    "rtp83": {
      "id": "rtp83",
      "targetReturnPercent": 83,
      "dealerBoostTickets": 1667,
      "playerUnfavorableTickets": 782,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:83",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 82.4935,
          "return95CI_Percent": [
            81.89245579756705,
            83.09454420243294
          ],
          "outcomes": {
            "blackjack": 4397,
            "win": 31553,
            "push": 8395,
            "lose": 55655
          }
        }
      }
    },
    "rtp84": {
      "id": "rtp84",
      "targetReturnPercent": 84,
      "dealerBoostTickets": 1531,
      "playerUnfavorableTickets": 718,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:84",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 83.6855,
          "return95CI_Percent": [
            83.08290576601004,
            84.28809423398997
          ],
          "outcomes": {
            "blackjack": 4627,
            "win": 31759,
            "push": 8600,
            "lose": 55014
          }
        }
      }
    },
    "rtp85": {
      "id": "rtp85",
      "targetReturnPercent": 85,
      "dealerBoostTickets": 1391,
      "playerUnfavorableTickets": 652,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:85",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 85.328,
          "return95CI_Percent": [
            84.72334468283694,
            85.93265531716308
          ],
          "outcomes": {
            "blackjack": 4542,
            "win": 32809,
            "push": 8355,
            "lose": 54294
          }
        }
      }
    },
    "rtp86": {
      "id": "rtp86",
      "targetReturnPercent": 86,
      "dealerBoostTickets": 1293,
      "playerUnfavorableTickets": 606,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:86",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 86.2725,
          "return95CI_Percent": [
            85.66769703661593,
            86.87730296338407
          ],
          "outcomes": {
            "blackjack": 4459,
            "win": 33326,
            "push": 8473,
            "lose": 53742
          }
        }
      }
    },
    "rtp87": {
      "id": "rtp87",
      "targetReturnPercent": 87,
      "dealerBoostTickets": 1194,
      "playerUnfavorableTickets": 560,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:87",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 87.044,
          "return95CI_Percent": [
            86.43880298863523,
            87.64919701136476
          ],
          "outcomes": {
            "blackjack": 4532,
            "win": 33534,
            "push": 8646,
            "lose": 53288
          }
        }
      }
    },
    "rtp88": {
      "id": "rtp88",
      "targetReturnPercent": 88,
      "dealerBoostTickets": 1061,
      "playerUnfavorableTickets": 497,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:88",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 87.977,
          "return95CI_Percent": [
            87.37077376999312,
            88.58322623000689
          ],
          "outcomes": {
            "blackjack": 4506,
            "win": 34095,
            "push": 8522,
            "lose": 52877
          }
        }
      }
    },
    "rtp89": {
      "id": "rtp89",
      "targetReturnPercent": 89,
      "dealerBoostTickets": 946,
      "playerUnfavorableTickets": 443,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:89",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 88.9525,
          "return95CI_Percent": [
            88.34527239633105,
            89.55972760366895
          ],
          "outcomes": {
            "blackjack": 4551,
            "win": 34544,
            "push": 8487,
            "lose": 52418
          }
        }
      }
    },
    "rtp90": {
      "id": "rtp90",
      "targetReturnPercent": 90,
      "dealerBoostTickets": 850,
      "playerUnfavorableTickets": 399,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:90",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 90.143,
          "return95CI_Percent": [
            89.5357356464511,
            90.75026435354889
          ],
          "outcomes": {
            "blackjack": 4562,
            "win": 35000,
            "push": 8738,
            "lose": 51700
          }
        }
      }
    },
    "rtp91": {
      "id": "rtp91",
      "targetReturnPercent": 91,
      "dealerBoostTickets": 719,
      "playerUnfavorableTickets": 337,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:91",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 90.641,
          "return95CI_Percent": [
            90.03291160705828,
            91.24908839294173
          ],
          "outcomes": {
            "blackjack": 4486,
            "win": 35474,
            "push": 8478,
            "lose": 51562
          }
        }
      }
    },
    "rtp92": {
      "id": "rtp92",
      "targetReturnPercent": 92,
      "dealerBoostTickets": 607,
      "playerUnfavorableTickets": 284,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:92",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 91.97999999999999,
          "return95CI_Percent": [
            91.37139945295797,
            92.58860054704202
          ],
          "outcomes": {
            "blackjack": 4476,
            "win": 36127,
            "push": 8536,
            "lose": 50861
          }
        }
      }
    },
    "rtp93": {
      "id": "rtp93",
      "targetReturnPercent": 93,
      "dealerBoostTickets": 496,
      "playerUnfavorableTickets": 233,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:93",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 92.8435,
          "return95CI_Percent": [
            92.2341052618629,
            93.4528947381371
          ],
          "outcomes": {
            "blackjack": 4579,
            "win": 36426,
            "push": 8544,
            "lose": 50451
          }
        }
      }
    },
    "rtp94": {
      "id": "rtp94",
      "targetReturnPercent": 94,
      "dealerBoostTickets": 407,
      "playerUnfavorableTickets": 191,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:94",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 93.9415,
          "return95CI_Percent": [
            93.3327987816091,
            94.55020121839091
          ],
          "outcomes": {
            "blackjack": 4463,
            "win": 37010,
            "push": 8764,
            "lose": 49763
          }
        }
      }
    },
    "rtp95": {
      "id": "rtp95",
      "targetReturnPercent": 95,
      "dealerBoostTickets": 277,
      "playerUnfavorableTickets": 130,
      "nativeLegacy": false,
      "measurements": {
        "source": "Independent finite six-deck actual-engine holdout",
        "handsPerStrategy": 100000,
        "seed": "indictus-blackjack-integer-rtp-INDEPENDENT-HOLDOUT-v2-2026-10-09:95",
        "basic_hit_stand": {
          "hands": 100000,
          "returnPercent": 95.17,
          "return95CI_Percent": [
            94.5602992282046,
            95.7797007717954
          ],
          "outcomes": {
            "blackjack": 4544,
            "win": 37564,
            "push": 8682,
            "lose": 49210
          }
        }
      }
    }
  }
};
