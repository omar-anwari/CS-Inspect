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
};