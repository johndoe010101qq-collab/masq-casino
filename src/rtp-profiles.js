const deepFreeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;};
export const MASK_RTP_PROFILES=deepFreeze({
  "revision": "mask-public-profile-v1",
  "baseSourceSHA256": "6e79d505a7a76fee47d47083cc5c2706d58e92332450ff541c1e9d659c8e4d0a",
  "derivedSourceSHA256": "f1663e96c220e67df17f901f64389b28269d7a0a245c0d9899214a8b59fb18fe",
  "ticketCount": 1000000,
  "method": "Independent public lottery before symbols;4 actual extra FS once per whole charged round. Paid gifts start or extend a promotional bonus; bought gifts extend its active tier. No extra payment, changed paytable or independent cap.",
  "confidence": "Measured full-charge gross return with normal95% Monte Carlo intervals. Preset labels are approximate calibration targets, not exact certified RTP.",
  "profiles": {
    "rtp50": {
      "id": "rtp50",
      "targetReturnPercent": 50,
      "validated": true,
      "offers": {
        "maskhouse:paid": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 50,
              "samples": 200000,
              "estimatedGrossReturnPercent": 50.7116214,
              "meanGrossReturn95CI_Percent": [
                49.69722461123559,
                51.72601818876428
              ],
              "positivePayoutFraction": 0.26546,
              "payoutAboveChargeFraction": 0.07357,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "9846445999606212658399810173861882196948738060109180418381926196742736948057975812445099860030543696735260754940553142350585319262771842684469377553120915064691874632895252512049259058980995360153516884682756906688231490627133010129895186467769440414164978273885572102024769515497905255002726765747480532547956099206407083663",
            "denominator": "393842053269155572108206512364693502513374977290770944144210055632695844602042757285141327884134136414515154962947019782419435896093666531529975185946108153872450272618354856215036852648007838406695647464247341953534559861936047601025802606246132855534536238705560426875739680850301161763971500817668996751308441162109375000000000000000",
            "upperBound": 2.500100209684072e-11,
            "upperBoundDecimal": "0.000000000025001002096840719128960501",
            "reciprocalUpperBound": 39998396709.320946
          }
        },
        "maskhouse:buy:sticky": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 1000,
              "samples": 30000,
              "estimatedGrossReturnPercent": 50.68834686666667,
              "meanGrossReturn95CI_Percent": [
                50.2768444238303,
                51.099849309503455
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.11946666666666667,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "27602574102967074740849156628879430195501255636939214709493905250642331841885298309753564564548126178404921613689779876378741435054944241301997340607050765080532240420950352796554968349819512184027604785694622359085672504951923160295676735653312901512951105907397192744801674000891565260474963320812170104691683433784",
            "denominator": "6576429287317626152073787450099943729355900871296064250213515945269817179957365945113598658532017603763363515666363780691845317014139023451176540540315614733570883077308797755892544712489382078620715450370266216955248366079687110602348087735214956990802874918578613900350796458407745994937290578263855422846972942352294921875",
            "upperBound": 4.1971977340648226e-9,
            "upperBoundDecimal": "0.000000004197197734064822306829637364",
            "reciprocalUpperBound": 238254202.7705564
          }
        },
        "lecipher:paid": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 50,
              "samples": 200000,
              "estimatedGrossReturnPercent": 49.3525181,
              "meanGrossReturn95CI_Percent": [
                48.27405347469234,
                50.430982725308425
              ],
              "positivePayoutFraction": 0.234085,
              "payoutAboveChargeFraction": 0.08618,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:buy:luck": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 1000,
              "samples": 30000,
              "estimatedGrossReturnPercent": 50.38269196666667,
              "meanGrossReturn95CI_Percent": [
                50.05951621250712,
                50.705867720827186
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.0593,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:buy:gold": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 1250,
              "samples": 30000,
              "estimatedGrossReturnPercent": 49.76878445333333,
              "meanGrossReturn95CI_Percent": [
                49.471252428424684,
                50.06631647824212
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.031766666666666665,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:paid:hunt": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 150,
              "samples": 30000,
              "estimatedGrossReturnPercent": 49.19516222222222,
              "meanGrossReturn95CI_Percent": [
                47.49076266842852,
                50.89956177601575
              ],
              "positivePayoutFraction": 0.2484,
              "payoutAboveChargeFraction": 0.1197,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:paid:rainbow": {
          "extraFreeSpins": 0,
          "ticketWeight": 0,
          "ticketCount": 1000000,
          "lotteryProbability": 0,
          "measured": [
            {
              "baseStakeAR": 50,
              "chargeAR": 500,
              "samples": 30000,
              "estimatedGrossReturnPercent": 50.57724233333334,
              "meanGrossReturn95CI_Percent": [
                49.418656556637984,
                51.735828110029146
              ],
              "positivePayoutFraction": 0.2157,
              "payoutAboveChargeFraction": 0.2071,
              "capRounds": 0,
              "lotteryRounds": 0
            }
          ],
          "measurementStage": "Calibration reference; default50 native results are unchanged.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        }
      }
    },
    "rtp55": {
      "id": "rtp55",
      "targetReturnPercent": 55,
      "validated": true,
      "offers": {
        "maskhouse:paid": {
          "extraFreeSpins": 4,
          "ticketWeight": 18470,
          "ticketCount": 1000000,
          "lotteryProbability": 0.01847,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 5,
              "samples": 20000,
              "estimatedGrossReturnPercent": 56.825,
              "meanGrossReturn95CI_Percent": [
                53.48414249599869,
                60.16585750400127
              ],
              "positivePayoutFraction": 0.27965,
              "payoutAboveChargeFraction": 0.08075,
              "capRounds": 0,
              "lotteryRounds": 395
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 50,
              "samples": 100000,
              "estimatedGrossReturnPercent": 54.1181306,
              "meanGrossReturn95CI_Percent": [
                52.67139466355346,
                55.56486653644649
              ],
              "positivePayoutFraction": 0.27884,
              "payoutAboveChargeFraction": 0.07841,
              "capRounds": 0,
              "lotteryRounds": 1903
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "44042805648622660571586080975067421209377884428555032952622184202891511527032380105548509082762752129703427818957687469378953480575473733312776742847042902697160040830598594438607971970540812525848558568007565720671860597963960653005247824440062554975058481338834851056423562409439223378539651162561654275219408133583850182841789853387872143454102239630371742892752992880948647",
            "denominator": "1631074989485610981485430150263495086456538452956292602213355370781543553995590302345573921886856788524543164152635351308470432750648130375609265348551594454171357599995919700693493148963916638011052518982535367177254706368440050999199513204821607435916008616004919144192029092544628212307180014662039479613009329489264514191702230596339896579344349447637796401977539062500000000000000000",
            "upperBound": 2.7002318061729556e-11,
            "upperBoundDecimal": "0.000000000027002318061729556932865109",
            "reciprocalUpperBound": 37033857527.117355
          }
        },
        "maskhouse:buy:sticky": {
          "extraFreeSpins": 4,
          "ticketWeight": 185172,
          "ticketCount": 1000000,
          "lotteryProbability": 0.185172,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 100,
              "samples": 20000,
              "estimatedGrossReturnPercent": 54.942661,
              "meanGrossReturn95CI_Percent": [
                54.40861212807721,
                55.476709871923276
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.1636,
              "capRounds": 0,
              "lotteryRounds": 3718
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 1000,
              "samples": 20000,
              "estimatedGrossReturnPercent": 54.92315085,
              "meanGrossReturn95CI_Percent": [
                54.38947630587338,
                55.45682539412699
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.16285,
              "capRounds": 0,
              "lotteryRounds": 3724
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "64166995801148687402127852955789632999232054453706411699739109782122020450795337583590062864131659260901926429997306601640676972416317094459453175816683549247903685936280446295587028893310449463514735015579809117564894932556242162639754844162953748602946264109421271519396089135983090401016427636651988653958370916608022621405024516709252088944892130247014271426879204",
            "denominator": "11348298598412329430573653539153020160412402804982378385090048603414850286431773141239186419069209504925165784316955536295769635585230450471344118141543393426789742163216882469736679309753240798378461761570232739449085916125512272316026836325421722174145289057927260673542535954896854066165107605164589115742717281501138182927021410682508040235205726276035420596599578857421875",
            "upperBound": 5.654327408174288e-9,
            "upperBoundDecimal": "0.000000005654327408174287608010853881",
            "reciprocalUpperBound": 176855694.37566185
          }
        },
        "lecipher:paid": {
          "extraFreeSpins": 4,
          "ticketWeight": 11144,
          "ticketCount": 1000000,
          "lotteryProbability": 0.011144,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 5,
              "samples": 20000,
              "estimatedGrossReturnPercent": 55.4767,
              "meanGrossReturn95CI_Percent": [
                51.98088845500973,
                58.972511544990965
              ],
              "positivePayoutFraction": 0.24995,
              "payoutAboveChargeFraction": 0.0943,
              "capRounds": 0,
              "lotteryRounds": 281
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 50,
              "samples": 100000,
              "estimatedGrossReturnPercent": 55.700189,
              "meanGrossReturn95CI_Percent": [
                54.093513892975054,
                57.30686410702498
              ],
              "positivePayoutFraction": 0.24215,
              "payoutAboveChargeFraction": 0.09282,
              "capRounds": 0,
              "lotteryRounds": 1101
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:buy:luck": {
          "extraFreeSpins": 4,
          "ticketWeight": 178835,
          "ticketCount": 1000000,
          "lotteryProbability": 0.178835,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 100,
              "samples": 20000,
              "estimatedGrossReturnPercent": 55.257341000000004,
              "meanGrossReturn95CI_Percent": [
                54.82098292977997,
                55.69369907021979
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.10425,
              "capRounds": 0,
              "lotteryRounds": 3574
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 1000,
              "samples": 20000,
              "estimatedGrossReturnPercent": 54.9677541,
              "meanGrossReturn95CI_Percent": [
                54.52951167677499,
                55.405996523225355
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.1011,
              "capRounds": 0,
              "lotteryRounds": 3584
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:buy:gold": {
          "extraFreeSpins": 4,
          "ticketWeight": 228416,
          "ticketCount": 1000000,
          "lotteryProbability": 0.228416,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 125,
              "samples": 20000,
              "estimatedGrossReturnPercent": 55.0940992,
              "meanGrossReturn95CI_Percent": [
                54.701488893324324,
                55.48670950667562
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.0649,
              "capRounds": 0,
              "lotteryRounds": 4623
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 1250,
              "samples": 20000,
              "estimatedGrossReturnPercent": 55.044424719999995,
              "meanGrossReturn95CI_Percent": [
                54.64689088891045,
                55.441958551089456
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.06905,
              "capRounds": 0,
              "lotteryRounds": 4529
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:paid:hunt": {
          "extraFreeSpins": 4,
          "ticketWeight": 34295,
          "ticketCount": 1000000,
          "lotteryProbability": 0.034295,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 15,
              "samples": 20000,
              "estimatedGrossReturnPercent": 56.39785666666667,
              "meanGrossReturn95CI_Percent": [
                54.21484167507396,
                58.58087165825959
              ],
              "positivePayoutFraction": 0.2783,
              "payoutAboveChargeFraction": 0.14415,
              "capRounds": 0,
              "lotteryRounds": 664
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 150,
              "samples": 20000,
              "estimatedGrossReturnPercent": 55.043186666666664,
              "meanGrossReturn95CI_Percent": [
                52.89578375213381,
                57.190589581199035
              ],
              "positivePayoutFraction": 0.27085,
              "payoutAboveChargeFraction": 0.14135,
              "capRounds": 0,
              "lotteryRounds": 727
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:paid:rainbow": {
          "extraFreeSpins": 4,
          "ticketWeight": 104014,
          "ticketCount": 1000000,
          "lotteryProbability": 0.104014,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 50,
              "samples": 20000,
              "estimatedGrossReturnPercent": 54.870675000000006,
              "meanGrossReturn95CI_Percent": [
                53.45177827840258,
                56.289571721597774
              ],
              "positivePayoutFraction": 0.2962,
              "payoutAboveChargeFraction": 0.22045,
              "capRounds": 0,
              "lotteryRounds": 2089
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 500,
              "samples": 20000,
              "estimatedGrossReturnPercent": 56.7181535,
              "meanGrossReturn95CI_Percent": [
                55.27724388553999,
                58.159063114460466
              ],
              "positivePayoutFraction": 0.30215,
              "payoutAboveChargeFraction": 0.22765,
              "capRounds": 0,
              "lotteryRounds": 2080
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        }
      }
    },
    "rtp60": {
      "id": "rtp60",
      "targetReturnPercent": 60,
      "validated": true,
      "offers": {
        "maskhouse:paid": {
          "extraFreeSpins": 4,
          "ticketWeight": 40004,
          "ticketCount": 1000000,
          "lotteryProbability": 0.040004,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 5,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.377210000000005,
              "meanGrossReturn95CI_Percent": [
                56.9700662201501,
                63.78435377984982
              ],
              "positivePayoutFraction": 0.29455,
              "payoutAboveChargeFraction": 0.0854,
              "capRounds": 0,
              "lotteryRounds": 773
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 50,
              "samples": 100000,
              "estimatedGrossReturnPercent": 60.0580314,
              "meanGrossReturn95CI_Percent": [
                58.56159000565477,
                61.55447279434467
              ],
              "positivePayoutFraction": 0.29402,
              "payoutAboveChargeFraction": 0.08614,
              "capRounds": 0,
              "lotteryRounds": 3924
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "119621545663314746624059291309703441667206955930536427706771900505349047680367690806835910226468596091052992744721401309105761142314555856846220758865123831301075037850852202385492946489577584478630599175918347872896204751410408430139679288957806473679302648470115921135411059698918683877184155340457391490687780887698538759427032746170456107068561422763813450673630640351793151",
            "denominator": "4077687473714027453713575375658737716141346132390731505533388426953858884988975755863934804717141971311357910381588378271176081876620325939023163371378986135428393999989799251733732872409791595027631297456338417943136765921100127497998783012054018589790021540012297860480072731361570530767950036655098699032523323723161285479255576490849741448360873619094491004943847656250000000000000000",
            "upperBound": 2.933563359978674e-11,
            "upperBoundDecimal": "0.000000000029335633599786743357839762",
            "reciprocalUpperBound": 34088235953.672043
          }
        },
        "maskhouse:buy:sticky": {
          "extraFreeSpins": 4,
          "ticketWeight": 399907,
          "ticketCount": 1000000,
          "lotteryProbability": 0.399907,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 100,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.20057250000001,
              "meanGrossReturn95CI_Percent": [
                59.64520739735994,
                60.755937602640046
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.2169,
              "capRounds": 0,
              "lotteryRounds": 7946
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 1000,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.3034974,
              "meanGrossReturn95CI_Percent": [
                59.74516513745689,
                60.86182966254312
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.22135,
              "capRounds": 0,
              "lotteryRounds": 8019
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "250028782790283230723778309484385213482187044270578015381366695686080091388863866408127703023964339206822920509915859001341951275915031935394359087126812433984820444668170114924434977133876035878023704338309477919516111906419849039933816959578152320968759835193673951383711161816803682716582876072410627472771760868074680363362805277054408181573666431756965673701642047",
            "denominator": "34044895795236988291720960617459060481237208414947135155270145810244550859295319423717559257207628514775497352950866608887308906755691351414032354424630180280369226489650647409210037929259722395135385284710698218347257748376536816948080508976265166522435867173781782020627607864690562198495322815493767347228151844503414548781064232047524120705617178828106261789798736572265625",
            "upperBound": 7.344090118356691e-9,
            "upperBoundDecimal": "0.000000007344090118356691164969511394",
            "reciprocalUpperBound": 136163906.4722914
          }
        },
        "lecipher:paid": {
          "extraFreeSpins": 4,
          "ticketWeight": 21010,
          "ticketCount": 1000000,
          "lotteryProbability": 0.02101,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 5,
              "samples": 20000,
              "estimatedGrossReturnPercent": 61.3549,
              "meanGrossReturn95CI_Percent": [
                57.62504697200385,
                65.084753027996
              ],
              "positivePayoutFraction": 0.24325,
              "payoutAboveChargeFraction": 0.09675,
              "capRounds": 0,
              "lotteryRounds": 426
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 50,
              "samples": 100000,
              "estimatedGrossReturnPercent": 59.60234679999999,
              "meanGrossReturn95CI_Percent": [
                57.99065192233989,
                61.214041677659935
              ],
              "positivePayoutFraction": 0.24929,
              "payoutAboveChargeFraction": 0.09978,
              "capRounds": 0,
              "lotteryRounds": 2037
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:buy:luck": {
          "extraFreeSpins": 4,
          "ticketWeight": 372492,
          "ticketCount": 1000000,
          "lotteryProbability": 0.372492,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 100,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.2319835,
              "meanGrossReturn95CI_Percent": [
                59.77136810869676,
                60.692598891302836
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.14395,
              "capRounds": 0,
              "lotteryRounds": 7392
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 1000,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.0009572,
              "meanGrossReturn95CI_Percent": [
                59.53339361109292,
                60.468520788906815
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.14695,
              "capRounds": 0,
              "lotteryRounds": 7400
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:buy:gold": {
          "extraFreeSpins": 4,
          "ticketWeight": 446737,
          "ticketCount": 1000000,
          "lotteryProbability": 0.446737,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 125,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.280305999999996,
              "meanGrossReturn95CI_Percent": [
                59.86417027719499,
                60.696441722805034
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.1085,
              "capRounds": 0,
              "lotteryRounds": 9047
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 1250,
              "samples": 20000,
              "estimatedGrossReturnPercent": 60.13353384,
              "meanGrossReturn95CI_Percent": [
                59.71822676879289,
                60.54884091120768
              ],
              "positivePayoutFraction": 1,
              "payoutAboveChargeFraction": 0.10515,
              "capRounds": 0,
              "lotteryRounds": 8982
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:paid:hunt": {
          "extraFreeSpins": 4,
          "ticketWeight": 63834,
          "ticketCount": 1000000,
          "lotteryProbability": 0.063834,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 15,
              "samples": 20000,
              "estimatedGrossReturnPercent": 61.155919999999995,
              "meanGrossReturn95CI_Percent": [
                58.92824328115944,
                63.383596718840735
              ],
              "positivePayoutFraction": 0.3004,
              "payoutAboveChargeFraction": 0.16095,
              "capRounds": 0,
              "lotteryRounds": 1310
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 150,
              "samples": 20000,
              "estimatedGrossReturnPercent": 61.03900133333333,
              "meanGrossReturn95CI_Percent": [
                58.81844147135627,
                63.259561195310376
              ],
              "positivePayoutFraction": 0.2957,
              "payoutAboveChargeFraction": 0.1611,
              "capRounds": 0,
              "lotteryRounds": 1302
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        },
        "lecipher:paid:rainbow": {
          "extraFreeSpins": 4,
          "ticketWeight": 221603,
          "ticketCount": 1000000,
          "lotteryProbability": 0.221603,
          "measured": [
            {
              "baseStakeAR": 5,
              "chargeAR": 50,
              "samples": 20000,
              "estimatedGrossReturnPercent": 59.076363,
              "meanGrossReturn95CI_Percent": [
                57.65911138976259,
                60.493614610237266
              ],
              "positivePayoutFraction": 0.3828,
              "payoutAboveChargeFraction": 0.2294,
              "capRounds": 0,
              "lotteryRounds": 4403
            },
            {
              "baseStakeAR": 50,
              "chargeAR": 500,
              "samples": 20000,
              "estimatedGrossReturnPercent": 58.742829900000004,
              "meanGrossReturn95CI_Percent": [
                57.33979858878096,
                60.14586121121929
              ],
              "positivePayoutFraction": 0.38445,
              "payoutAboveChargeFraction": 0.2289,
              "capRounds": 0,
              "lotteryRounds": 4357
            }
          ],
          "measurementStage": "Independent holdout; parameters frozen from calibration.",
          "rareHardCapUnionUpperBound": {
            "numerator": "2401",
            "denominator": "50952300312500",
            "upperBound": 4.712250448506186e-11,
            "upperBoundDecimal": "0.000000000047122504485061858805552823",
            "reciprocalUpperBound": 21221282928.987923
          }
        }
      }
    }
  }
});
export function getMaskProfileSnapshot(value=50,{game,mode='paid',bonusTier,featureMode}={}){
 const id=typeof value==='number'?'rtp'+value:value;
 const profile=Object.hasOwn(MASK_RTP_PROFILES.profiles,id)?MASK_RTP_PROFILES.profiles[id]:null;
 if(!profile)throw new RangeError('Unknown public RTP profile.');
 if(!['maskhouse','lecipher'].includes(game))throw new RangeError('Unsupported profiled slot.');
 const offer=game+':'+mode+(mode==='buy'?':'+(bonusTier??(game==='maskhouse'?'sticky':'luck')):(featureMode!=null?':'+featureMode:''));
 const spec=profile.offers[offer];if(!spec)throw new RangeError('Unsupported profiled offer.');
 if(!profile.validated)throw new RangeError('This RTP preset has not passed independent validation.');
 return deepFreeze({id,revision:MASK_RTP_PROFILES.revision,targetReturnPercent:profile.targetReturnPercent,baseSourceSHA256:MASK_RTP_PROFILES.baseSourceSHA256,derivedSourceSHA256:id==='rtp50'?null:MASK_RTP_PROFILES.derivedSourceSHA256,offer,...spec});
}
