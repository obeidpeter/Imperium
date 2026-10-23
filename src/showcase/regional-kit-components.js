// Generated from the full authored silhouettes by scripts/assets/build-regional-kits.py.
// Metres [width, height, depth], conservatively rounded up. Roots are centred at ground zero.
export const REGIONAL_KIT_COMPONENTS = {
  "danube-military-kit": {
    "barrack_gable": [
      5.657,
      4.256,
      6.56
    ],
    "storehouse_raised": [
      5.6,
      4.801,
      5.675
    ],
    "timber_gate": [
      6.038,
      4.286,
      3.661
    ],
    "palisade_bay": [
      4.2,
      3.101,
      0.438
    ],
    "watch_platform": [
      3.747,
      6.986,
      3.86
    ],
    "tiled_portico": [
      6.03,
      3.686,
      3.36
    ],
    "granary_vent": [
      3.8,
      1.65,
      1.5
    ],
    "ditch_bridge": [
      3.501,
      1.501,
      5.0
    ],
    "forge_shelter": [
      4.834,
      3.4,
      3.86
    ],
    "stone_well": [
      2.859,
      3.336,
      2.26
    ],
    "signal_beacon": [
      1.8,
      2.809,
      1.8
    ],
    "milestone_base": [
      1.3,
      1.9,
      1.3
    ]
  },
  "river-wetlands-kit": {
    "duckboard_straight": [
      2.501,
      0.951,
      5.0
    ],
    "duckboard_corner": [
      3.401,
      1.001,
      3.401
    ],
    "landing_steps": [
      3.101,
      2.447,
      3.637
    ],
    "mooring_jetty": [
      3.4,
      1.601,
      6.0
    ],
    "reed_screen": [
      3.901,
      2.119,
      0.191
    ],
    "stilt_store": [
      4.756,
      4.886,
      5.061
    ],
    "fish_drying_rack": [
      3.841,
      2.451,
      2.001
    ],
    "flood_revetment": [
      4.101,
      1.38,
      1.011
    ],
    "ferry_shelter": [
      5.0,
      3.0,
      3.903
    ],
    "rope_bollards": [
      3.04,
      1.3,
      0.541
    ],
    "levee_stair": [
      2.201,
      1.5,
      3.015
    ],
    "bridge_trestle": [
      5.501,
      2.627,
      2.735
    ]
  },
  "italian-marching-kit": {
    "command_pavilion": [
      7.636,
      3.951,
      5.669
    ],
    "ridge_tent": [
      3.62,
      2.561,
      4.2
    ],
    "officers_awning": [
      4.301,
      2.951,
      3.703
    ],
    "wagon_shed": [
      6.34,
      4.386,
      5.361
    ],
    "roadside_shrine": [
      2.564,
      3.26,
      2.481
    ],
    "marching_gate": [
      6.625,
      3.32,
      1.001
    ],
    "field_kitchen": [
      4.301,
      2.85,
      3.503
    ],
    "baggage_rack": [
      3.641,
      2.1,
      1.701
    ],
    "drainage_crossing": [
      3.6,
      0.981,
      2.901
    ],
    "vine_pergola": [
      5.301,
      2.751,
      3.701
    ],
    "road_marker": [
      1.3,
      2.2,
      1.201
    ],
    "canvas_windbreak": [
      4.24,
      2.001,
      0.701
    ]
  },
  "provincial-civic-kit": {
    "raised_granary": [
      6.0,
      5.011,
      5.66
    ],
    "tribunal_portico": [
      6.043,
      4.736,
      3.961
    ],
    "farm_courtyard_wall": [
      5.25,
      2.015,
      0.801
    ],
    "tile_roof_store": [
      5.053,
      3.911,
      5.06
    ],
    "market_stall": [
      4.236,
      3.186,
      3.36
    ],
    "olive_press_frame": [
      3.0,
      2.951,
      2.5
    ],
    "irrigation_sluice": [
      2.151,
      1.621,
      3.3
    ],
    "pergola_arcade": [
      6.04,
      2.956,
      3.801
    ],
    "boundary_cairn": [
      1.921,
      1.19,
      0.65
    ],
    "public_fountain": [
      3.0,
      1.701,
      3.0
    ],
    "tally_counter": [
      3.201,
      1.375,
      2.1
    ],
    "produce_store": [
      4.351,
      3.486,
      4.06
    ]
  },
  "roman-monumental-kit": {
    "apsidal_hall": [
      7.2,
      5.705,
      9.86
    ],
    "colonnade_bay": [
      5.6,
      4.321,
      2.0
    ],
    "archive_stalls": [
      5.7,
      3.401,
      2.401
    ],
    "checkpoint_arch": [
      5.45,
      5.2,
      1.8
    ],
    "tribunal_dais": [
      5.7,
      2.1,
      3.8
    ],
    "monumental_stair": [
      6.051,
      2.652,
      4.202
    ],
    "garden_exedra": [
      5.497,
      0.75,
      2.73
    ],
    "civic_fountain": [
      4.0,
      2.161,
      4.0
    ],
    "screen_wall": [
      5.7,
      3.21,
      0.801
    ],
    "vaulted_entry": [
      3.85,
      3.804,
      3.181
    ],
    "administrative_portico": [
      7.142,
      5.336,
      4.261
    ],
    "statue_plinth": [
      2.5,
      2.09,
      2.5
    ]
  }
};
for (const kit of Object.values(REGIONAL_KIT_COMPONENTS)) {
  for (const dimensions of Object.values(kit)) Object.freeze(dimensions);
  Object.freeze(kit);
}
Object.freeze(REGIONAL_KIT_COMPONENTS);
