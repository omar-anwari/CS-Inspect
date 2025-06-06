/**
 * Maps the normalized skin names (lowercase, no spaces) to their corresponding VMAT pattern name.
 * The key is what will be extracted from the skin name (e.g., "pole position" -> "poleposition").
 * The value is the actual pattern name used in the VMAT files (e.g., "cu_cz75_precision").
 */
export const MATERIAL_ALIASES: Record<string, string> = {
    // Weapon Skins
    //CZ
    victoria: 'aq_etched_cz75',
    thefuschiaisnow: 'am_fuschia', //intentional spelling mistake
    xiangliu: 'gs_cz_snakes_purple',
    yellowjacket: 'cu_cz75a_chastizer',
    chalice: 'am_royal', //broken
    treadplate: 'am_diamond_plate', //half broken
    syndicate: 'gs_train_cz75',
    slalom: 'cu_abstract_white_cz',
    eco: 'cu_cz75_eco',
    tigris: 'cu_c75a-tiger',
    tacticat: 'cz75_tacticat',
    poleposition: 'cu_cz75_precision',
    redastor: 'gs_cz75a_redastor',
    emeraldquartz: 'am_crystallized_green', //half broken
    emerald: 'an_emerald', //broken
    poisondart: 'am_nitrogen', //half broken
    twist: 'am_gyrate', //half broken
    hexane: 'hy_bluehex', //half broken
    crimsonweb1: 'hy_webs', //broken
    vendetta: 'gs_cz75_vendetta',
    tuxedo: 'so_orca', //broken
    nitro: 'so_orange_accents2', //broken
    circaetus: 'cu_cz75_whirlwind',
    polymer: 'am_czv2_mf', //half broken
    imprint: 'gs_cz75_tread',
    distressed: 'cu_cz75_cerakote',
    silver: 'an_silver', //broken
    copperfiber: 'am_carbon_fiber', //broken
    midnightpalm: 'sp_palm_night', //broken
    greenplaid: 'hy_plaid2', //broken
    armysheen: 'am_army_shine', //broken
    indigo: 'so_indigo_and_grey', //broken
    jungledashed: 'sp_tape_short_jungle', //broken
    pinkpearl: 'soe_pink_pearl', //broken
    framework: 'hy_vertigoillusion', //half broken
    
    // Deagle
    goldenkoi: 'am_scales_bravo', //broken
    printstream: 'cu_deag_printstream',
    codered: 'gs_deagle_aggressor',
    oceandrive: 'cu_deagle_kitch',
    fennecfox: 'gs_deagle_fennec',
    hypnotic: 'aa_vertigo', //broken
    cobaltdisruption: 'am_ddpatdense_peacock', //broken
    starcade: 'cu_glitter_deagle',
    kumichodragon: 'aq_deserteagle_kumichodragon',
    conspiracy: 'cu_deagle_aureus',
    mechaindustries: 'gs_deagle_mecha',
    heattreated: 'aq_deagle_case_hardened_2', //broken
    blaze: 'aa_flames', //broken
    emeraldjrmungandr: 'am_jorm_green',
    sunsetstorm: 'am_seastorm_blood', //broken
    sunsetstorm2: 'am_seastorm_shojo', //broken
    handcannon: 'aq_handcannon',
    pilot: 'aq_pilot_deagle',
    mulberry: 'soe_plum',
    crimsonweb2: 'hy_webs_darker', //broken and update handling skins with the same name
    heirloom: 'aq_engraved_deagle',
    naga: 'aq_deagle_naga',
    lightrail: 'gs_deagle_exo',
    serpentstrike: 'deagle_snake_pattern', //broken
    triggerdiscipline: 'cu_deag_trigger_discipline',
    directive: 'aq_desert_eagle_constable',
    nightheist: 'am_heist_plans_purple', //broken
    mintfan: 'ht_earth_fans', //broken
    sputnik: 'sp_spacerace_blue', //broken
    meteorite: 'am_crystallized_dark', //broken
    urbanrubble: 'hy_varicamo_urban', //broken
    oxideblaze: 'cu_desert_eagle_corroden',
    corinthian: 'aq_deagle_corinthian',
    blueply: 'cu_deagle_replica',
    bronzedeco: 'am_bronze_sparkle', //broken
    calligraffiti: 'deagle_calligraff',
    midnightstorm: 'am_seastorm', //broken
    night: 'so_night',
    thebronze: 'am_numbers_bronze', //broken
    urbanddpat: 'hy_ddpat_urb', //broken
    tilted: 'cu_overpass_aqua_deagle',
    mudder: 'hy_mottled_sand', //broken

    // Dualies
    cobrastrike: 'gs_dualberettas_cobra',
    twinturbo: 'cu_dual_elites_rally',
    melondrama: 'cu_elites_beware',
    duelist: 'gs_mother_of_pearl_elite',
    hemoglobin: 'am_ossify_red', //broken
    demolition: 'so_tangerine',
    marina: 'hy_marina_sunrise', //broken
    sweetlittleangels: 'cu_overpass_baby_dualies',
    dezastre: 'gs_dual_elites_dezastre',
    urbanshock: 'cu_elites_urbanstorm',
    hydrostrike: 'dual_elite_hydro_strike',
    royalconsorts: 'gs_dual_berettas_golden_venice', //sort of broken, parts aren't gold
    floracarnivora: 'cu_dual_elites_evil_flora',
    cobaltquartz: 'am_crystallized_blue', //broken
    // emerald: 'an_emerald' //already handled in CZ75, still broken
    blacklimba: 'cu_season_elites_bravo',
    retribution: 'cu_retribution',
    anodizednavy: 'an_navy', //broken
    panther: 'so_panther',
    balance: 'gs_dual_elites_rose',
    tread: 'gs_dual_berettas_tread',
    cartel: 'aq_dualberettas_cartel',
    shred: 'sp_elites_winter_raider', //broken
    elite16:'gs_dual_elites_classic',
    ventilators: 'gs_dualberettas_ventilators',
    hideout: 'dual_berettas_lethal_grin',
    pyre: 'hy_gelpen_dark', //broken
    switchboard: 'hy_numbers_green', //broken
    rosenacre: 'soo_rose_gold', //broken
    polishedmalachite: 'soch_marble_grips', //broken
    stained: 'aq_forced', //figure out patterns
    driftwood: 'sp_dry_wood', //broken
    mooninlibra: 'hy_zodiac1', //broken
    briar: 'hy_vines', //broken
    heist: 'am_heist_plans_green', //broken
    bordeux: 'soch_acrylic_grips', //broken
    colony: 'so_space_marine', //check if the name is correct
    oilchange: 'sp_engine_dirty', //broken
    contractor: 'so_pmc', //check if the name is correct

    // Five-SeveN
    hyperbeast: 'cu_fiveseven_hyperbeast',
    angrymob: 'cu_five_seven_angry',
    fallhazard: 'cu_vertigo_fiveseven',
    fairytale: 'cu_five_seven_diary',
    monkeybusiness: 'cu_fiveseven_banana',
    fowlplay: 'aq_57_feathers',
    neonkimono: 'hy_kimono_diamonds', //broken
    berriesandcherries: 'aa_fade_red_blue', //broken
    casehardened: 'aq_oiled', //half broken
    coppergalaxy: 'am_copper_flecks', //broken
    // heattreated: 'aq_case_hardened_fiveseven', deagle has the same name, change normalization to include weapon name
    triumvirate: 'cu_fiveseven_augmented',
    boostprotocol: 'gs_five_seven_efusion',
    hybrid: 'fiveseven_hybrid',
    retrobution: 'cu_fiveseven_retrobution',
    buddy: 'cu_fiveseven_gsg9',
    crimsonblossom: 'hy_bud_red', //broken
    // nitro: 'so_orange_accents', //m4 has the same name, change normalization to include weapon name
    nightshade: 'hy_flowers', //broken
    kami: 'hy_kami', //broken
};