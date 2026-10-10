// Public fixed probability profiles, frozen before independent validation.
// Native50 delegates the unchanged core. Profiles55/60 alter only disclosed draw weights.
function freeze(value) { if (value && typeof value==='object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export const BONANZA_RTP_PROFILES=freeze({
  "rtp50": {
    "id": "rtp50",
    "targetReturnPercent": 50,
    "probabilityWeights": {
      "baseWeights": [
        [
          "hood",
          80
        ],
        [
          "suit",
          85
        ],
        [
          "glove",
          90
        ],
        [
          "laptop",
          95
        ],
        [
          "usb",
          100
        ],
        [
          "lock",
          105
        ],
        [
          "key",
          110
        ],
        [
          "radio",
          115
        ],
        [
          "flag",
          120
        ],
        [
          "scatter",
          20
        ]
      ],
      "freeWeights": [
        [
          "hood",
          45
        ],
        [
          "suit",
          49
        ],
        [
          "glove",
          53
        ],
        [
          "laptop",
          57
        ],
        [
          "usb",
          61
        ],
        [
          "lock",
          150
        ],
        [
          "key",
          156
        ],
        [
          "radio",
          162
        ],
        [
          "flag",
          168
        ],
        [
          "scatter",
          1
        ],
        [
          "bomb",
          3
        ]
      ],
      "bombWeights": [
        [
          2,
          9000
        ],
        [
          3,
          700
        ],
        [
          4,
          80
        ],
        [
          5,
          40
        ],
        [
          6,
          20
        ],
        [
          8,
          8
        ],
        [
          10,
          3
        ],
        [
          12,
          1
        ],
        [
          15,
          1
        ],
        [
          20,
          1
        ],
        [
          25,
          1
        ]
      ]
    },
    "revision": "indictus-bonanza-demo-fixed-weights-2026-10-09-v12",
    "baseSourceSHA256": "6868ec7dc51da9aba0a8c8a37f5ee9bb6b2267cab7e14940b62c5ea8270b0d96",
    "profileEngineSourceSHA256": "94d49ce4315f7c788818f393c7aca9c855951f87ef2b2c5787c84b78fcaef4a4",
    "selectionMethod": "native",
    "ticketDenominator": 1000000,
    "paid": {
      "extraSpins": 0,
      "ticketWeight": 0,
      "extraAwardChance": 0
    },
    "buy": {
      "extraSpins": 0,
      "ticketWeight": 0,
      "extraAwardChance": 0
    }
  },
  "rtp55": {
    "id": "rtp55",
    "targetReturnPercent": 55,
    "probabilityWeights": {
      "baseWeights": [
        [
          "hood",
          80000
        ],
        [
          "suit",
          85000
        ],
        [
          "glove",
          90000
        ],
        [
          "laptop",
          95000
        ],
        [
          "usb",
          100000
        ],
        [
          "lock",
          105000
        ],
        [
          "key",
          110000
        ],
        [
          "radio",
          115000
        ],
        [
          "flag",
          120000
        ],
        [
          "scatter",
          21720
        ]
      ],
      "freeWeights": [
        [
          "hood",
          45000
        ],
        [
          "suit",
          49000
        ],
        [
          "glove",
          53000
        ],
        [
          "laptop",
          57000
        ],
        [
          "usb",
          61000
        ],
        [
          "lock",
          150000
        ],
        [
          "key",
          156000
        ],
        [
          "radio",
          162000
        ],
        [
          "flag",
          168000
        ],
        [
          "scatter",
          1000
        ],
        [
          "bomb",
          5000
        ]
      ],
      "bombWeights": [
        [
          2,
          9000
        ],
        [
          3,
          700
        ],
        [
          4,
          80
        ],
        [
          5,
          40
        ],
        [
          6,
          20
        ],
        [
          8,
          8
        ],
        [
          10,
          3
        ],
        [
          12,
          1
        ],
        [
          15,
          1
        ],
        [
          20,
          1
        ],
        [
          25,
          1
        ]
      ]
    },
    "revision": "indictus-bonanza-demo-fixed-weights-2026-10-09-v12",
    "baseSourceSHA256": "6868ec7dc51da9aba0a8c8a37f5ee9bb6b2267cab7e14940b62c5ea8270b0d96",
    "profileEngineSourceSHA256": "94d49ce4315f7c788818f393c7aca9c855951f87ef2b2c5787c84b78fcaef4a4",
    "selectionMethod": "fixed-symbol-weights",
    "ticketDenominator": 1000000,
    "paid": {
      "extraSpins": 0,
      "ticketWeight": 0,
      "extraAwardChance": 0
    },
    "buy": {
      "extraSpins": 0,
      "ticketWeight": 0,
      "extraAwardChance": 0
    }
  },
  "rtp60": {
    "id": "rtp60",
    "targetReturnPercent": 60,
    "probabilityWeights": {
      "baseWeights": [
        [
          "hood",
          80000
        ],
        [
          "suit",
          85000
        ],
        [
          "glove",
          90000
        ],
        [
          "laptop",
          95000
        ],
        [
          "usb",
          100000
        ],
        [
          "lock",
          105000
        ],
        [
          "key",
          110000
        ],
        [
          "radio",
          115000
        ],
        [
          "flag",
          120000
        ],
        [
          "scatter",
          22510
        ]
      ],
      "freeWeights": [
        [
          "hood",
          45000
        ],
        [
          "suit",
          49000
        ],
        [
          "glove",
          53000
        ],
        [
          "laptop",
          57000
        ],
        [
          "usb",
          61000
        ],
        [
          "lock",
          150000
        ],
        [
          "key",
          156000
        ],
        [
          "radio",
          162000
        ],
        [
          "flag",
          168000
        ],
        [
          "scatter",
          1000
        ],
        [
          "bomb",
          7000
        ]
      ],
      "bombWeights": [
        [
          2,
          9000
        ],
        [
          3,
          700
        ],
        [
          4,
          80
        ],
        [
          5,
          40
        ],
        [
          6,
          20
        ],
        [
          8,
          8
        ],
        [
          10,
          3
        ],
        [
          12,
          1
        ],
        [
          15,
          1
        ],
        [
          20,
          1
        ],
        [
          25,
          1
        ]
      ]
    },
    "revision": "indictus-bonanza-demo-fixed-weights-2026-10-09-v12",
    "baseSourceSHA256": "6868ec7dc51da9aba0a8c8a37f5ee9bb6b2267cab7e14940b62c5ea8270b0d96",
    "profileEngineSourceSHA256": "94d49ce4315f7c788818f393c7aca9c855951f87ef2b2c5787c84b78fcaef4a4",
    "selectionMethod": "fixed-symbol-weights",
    "ticketDenominator": 1000000,
    "paid": {
      "extraSpins": 0,
      "ticketWeight": 0,
      "extraAwardChance": 0
    },
    "buy": {
      "extraSpins": 0,
      "ticketWeight": 0,
      "extraAwardChance": 0
    }
  }
});
export function getBonanzaProfileSnapshot(value=50,offer='paid') {
  const id=typeof value==='number'?'rtp'+value:typeof value==='string'&&/^\d+$/.test(value)?'rtp'+value:value;
  if (!Object.hasOwn(BONANZA_RTP_PROFILES,id)) throw new RangeError('Bonanza DEMO profile must be50,55 or60');
  if (!['paid','buy','preview'].includes(offer)) throw new RangeError('Invalid Bonanza offer');
  const profile=BONANZA_RTP_PROFILES[id],w=profile.probabilityWeights;
  const probabilities=Object.fromEntries(Object.entries(w).map(([name,entries])=>{
    const totalWeight=entries.reduce((sum,[,weight])=>sum+weight,0);
    return [name,{totalWeight,entries:entries.map(([item,weight])=>({item,weight,probability:weight/totalWeight}))}];
  }));
  return freeze({id,revision:profile.revision,targetReturnPercent:profile.targetReturnPercent,
    baseSourceSHA256:profile.baseSourceSHA256,profileEngineSourceSHA256:profile.profileEngineSourceSHA256,
    offer,selectionMethod:profile.selectionMethod,probabilityWeights:w,probabilities,
    extraFreeSpins:0,offeredExtraFreeSpins:0,ticketWeight:0,ticketDenominator:profile.ticketDenominator,
    ticketCount:profile.ticketDenominator,extraAwardChance:0,lotteryProbability:0,calibrationPredictedReturn:null,
    notice:'Открытый демо-профиль с фиксированными весами символов. Для каждого нового символа вероятность равна его весу, делённому на сумму весов соответствующей таблицы. Профиль не добавляет вращения. Бонус начинается с 10 вращений; 3 и более SCATTER в бесплатном вращении дают только обычный ретриггер +5. Таблицы выплат, цена покупки ×50 и лимит всего раунда 100 ставок минус 1 АР сохраняются. Ориентир RTP — приблизительная цель калибровки, не гарантия результата. Баланс, игрок и история не меняют веса.'});
}
