-- Dashboard StoreMaster peer metadata
-- Source: 156 non-closed stores from the OPPO store master workbook.
-- Tier: Top = 42 real stores from the weekly 43-store account list (excluding placeholder xxx); Normal = remaining 114.
-- KPI Plan for Top: Benchmark when master labels contain 标杆店/APAC标杆店;
-- BKK by OPPO when Area starts BKK and store is By OPPO; otherwise Non-Benchmark.
-- Normal tier always uses KPI Plan = Normal.

ALTER TABLE "StoreMaster"
  ADD COLUMN IF NOT EXISTS "dashboardTier" TEXT,
  ADD COLUMN IF NOT EXISTS "kpiPlan" TEXT,
  ADD COLUMN IF NOT EXISTS "dashboardArea" TEXT,
  ADD COLUMN IF NOT EXISTS "bmName" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreMaster_dashboardTier_check'
  ) THEN
    ALTER TABLE "StoreMaster"
      ADD CONSTRAINT "StoreMaster_dashboardTier_check"
      CHECK ("dashboardTier" IS NULL OR "dashboardTier" IN ('Top', 'Normal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoreMaster_kpiPlan_check'
  ) THEN
    ALTER TABLE "StoreMaster"
      ADD CONSTRAINT "StoreMaster_kpiPlan_check"
      CHECK ("kpiPlan" IS NULL OR "kpiPlan" IN ('Benchmark', 'BKK by OPPO', 'Non-Benchmark', 'Normal'));
  END IF;
END $$;

WITH profile("storeId", "storeName", "dashboardTier", "kpiPlan", "dashboardArea", "bmName") AS (
VALUES
  ('24402', 'OBS Lotus Saraburi By Tap phone', 'Normal', 'Normal', 'Saraburi', '6700696 Panuwat Siyang'),
  ('25003', 'OBS The Mall Bangkae FL.1 By OPPO', 'Top', 'BKK by OPPO', 'BKK-W2B', '6400236 Thanapat Buranrat'),
  ('32569', 'OBS Central Khonkaen Campus FL.1 By OPPO', 'Top', 'Non-Benchmark', 'Khon Kaen 1', '6802537 Kanokvalee Sopajit'),
  ('27273', 'OBS Stand Alone Narathiwat By S.O.Phone', 'Normal', 'Normal', 'Yala', '5902959 Masrunee Lateh'),
  ('30360', 'OBS Central Nakhon Pathom FL.1 By OPPO', 'Normal', 'Normal', 'Nakhon Pathom', '5803001 Pimpen Janprapa'),
  ('26234', 'OBS Lotus Wiang Sa FL.1 By DD PHONE', 'Normal', 'Normal', 'Surat Thani', '6303606 Supreeya Thongthap'),
  ('28818', 'OBS Coliseum Yala By OPPO', 'Normal', 'Normal', 'Yala', '6105240 Hayatee Tehbakong'),
  ('28764', 'OBS Lotus Kamtieang By TG', 'Normal', 'Normal', 'Chiang Mai', '6900494 Pimlada Thaweedetakkharaphong'),
  ('3791', 'OBS Central Khonkaen FL.3 By OPPO', 'Top', 'Benchmark', 'Khon Kaen 1', '6702611 Bordin Mahamol'),
  ('21064', 'OBS Central Rama 2 FL.2 By Com7', 'Normal', 'Normal', 'BKK-W2A', NULL),
  ('27834', 'OBS Central Chaengwattana By OPPO', 'Normal', 'Normal', 'BKK-W1C', '6009053 Aunchalee Wanjanabee'),
  ('32287', 'OBS Siam TV Ruam Chok By Siam TV', 'Normal', 'Normal', 'Chiang Mai', '5801494 Kamonporn Jitkawinthip'),
  ('30606', 'OBS Central Suratthani FL.2 By OPPO 2', 'Normal', 'Normal', 'Surat Thani', '5900139 Jutamas Kongyoo'),
  ('30413', 'OBS Big C Suratthani By OPPO', 'Normal', 'Normal', 'Surat Thani', '6802318 Pattama Promsri'),
  ('30194', 'OBS Big C Lamphun By Com7', 'Normal', 'Normal', 'Lampang', 'NO BM'),
  ('30501', 'OBS Central Rayong FL.2 By OPPO', 'Normal', 'Normal', 'Rayong', '6700133 tippawan sonsree'),
  ('27897', 'OBS Central Ayutthaya FL.1 By OPPO', 'Normal', 'Normal', 'Ayutthaya', '6502423 Natthakit Ruanthong'),
  ('26197', 'OBS Big C Chiangrai By IT CITY', 'Normal', 'Normal', 'Chiang Rai', '6401600 Jidaphan Lertwiriyasakoonchai'),
  ('27626', 'OBS Asawann Nongkhai By OPPO', 'Normal', 'Normal', 'Nong Khai', '6701936 Pakwalan Phatikkabut'),
  ('27346', 'OBS Big C Aomyai FL.2 By Com7', 'Normal', 'Normal', 'Nakhon Pathom', 'NO BM'),
  ('24804', 'OBS The Mall Ngam Wong Wan FL.3 By OPPO', 'Top', 'Benchmark', 'BKK-W1B', '6004760 Tinmanee Boaboon'),
  ('27347', 'OBS Big C Nakhon Pathom FL.1 By Com7', 'Top', 'Non-Benchmark', 'Nakhon Pathom', 'NO BM'),
  ('27893', 'OBS Central Hatyai 1 FL.3 By OPPO', 'Normal', 'Normal', 'Hat Yai', '6202353 Pattaya Madadam'),
  ('30530', 'OBS Lotus Phetchabun By IT CITY', 'Normal', 'Normal', 'Lop Buri', 'NO BM'),
  ('2997', 'OBS Central Pattaya Beach FL.3 By OPPO', 'Normal', 'Normal', 'Pattaya 1', '5901255 Yuttapoom Okrurn'),
  ('27397', 'OBS Lotus Hatyai By Com7', 'Normal', 'Normal', 'Hat Yai', 'NO BM'),
  ('30040', 'OBS Lotus Chumphon FL.2 By OPPO', 'Normal', 'Normal', 'Prachuap Khiri Khan', '6302011 Kanjana Rattana'),
  ('22868', 'OBS Big C Klong Khae Hatyai FL.2 By Com7', 'Normal', 'Normal', 'Hat Yai', 'NO BM'),
  ('30258', 'OBS Central Nakhon Sawan FL.1 By OPPO', 'Top', 'Non-Benchmark', 'Nakhon Sawan', '6205958 Kanokporn Kulkarineetham'),
  ('26456', 'OBS Big C Lampang By IT CITY', 'Top', 'Non-Benchmark', 'Lampang', '6101619 Thanee Ngamngon'),
  ('30165', 'OBS Central Westville FL.2 By OPPO', 'Top', 'BKK by OPPO', 'BKK-W1A', '6700044 Witsarut Yuramat'),
  ('31166', 'OBS Lotus Srinakarin By TG', 'Normal', 'Normal', 'BKK-E2A', '6007203 Phattaraporn Sutthide'),
  ('31736', 'OBS Central Krabi FL.G by OPPO', 'Normal', 'Normal', 'Trang', '6301748 Ketwarin Chaida'),
  ('27369', 'OBS Ayutthaya City Park By TG 1', 'Normal', 'Normal', 'Ayutthaya', '6602382 Phasit Chomsirikarnkul'),
  ('26239', 'OBS Central Rama 3 FL.3 By OPPO', 'Top', 'Benchmark', 'BKK-E3B', '6304240 Nisakorn Thapbun'),
  ('9162', 'OBS Robinson Maesot FL.2 By Chin Mobile', 'Normal', 'Normal', 'Sukhothai', '5900614 Wanida Pongsing'),
  ('28243', 'OBS Seacon Bangkae FL.2 By OPPO', 'Normal', 'Normal', 'BKK-E3C', '6701287 Jetsadakorn Suksod'),
  ('32564', 'OBS Lotus Thathong FL.1 By OPPO', 'Normal', 'Normal', 'Phitsanulok', '6402070 Auemporn Prompak'),
  ('20446', 'OBS SiamTV Chiangmai By SiamTV', 'Normal', 'Normal', 'Chiang Mai', '5801494 Kamonporn Jitkawinthip'),
  ('28326', 'OBS Central Rama 2 FL.2 By OPPO', 'Normal', 'Normal', 'BKK-W2A', '6700075 Kawin Puangngern'),
  ('17469', 'OBS Lotus Chum Phae Khonkaen FL.1 By Com7', 'Normal', 'Normal', 'Khon Kaen 1', 'NO BM'),
  ('28375', 'OBS Robinson Chonburi By OPPO', 'Normal', 'Normal', 'Chon Buri', '6401873 Kanyarat Wano'),
  ('31414', 'OBS Robinson Roi Et FL.2 By TG', 'Normal', 'Normal', 'Roi Et', '6800074 Anantachai Sangkamanee'),
  ('28122', 'OBS Central Hatyai 2 FL.3 By OPPO 2', 'Top', 'Non-Benchmark', 'Hat Yai', '5700452 Jantarawadee Kosai'),
  ('30828', 'OBS Huamark Town Center FL.0B By TG', 'Normal', 'Normal', 'BKK-E4A', '6702447 Assma​ lohhem'),
  ('25635', 'OBS Robinson Ladkrabang By OPPO', 'Top', 'BKK by OPPO', 'BKK-E2C', '6702083 Sasima Phothikham'),
  ('27349', 'OBS Ronbinson Prachinburi FL.2 By Jaymart', 'Normal', 'Normal', 'Prachin Buri', '6800568 Sukchai Jitsoontorn'),
  ('109', 'OBS Seacon Square Srinakarin FL.2 By OPPO', 'Normal', 'Normal', 'BKK-E2A', '6502762 Amintra Aiamklam'),
  ('31682', 'OBS Future Park Rangsit FL.3 By TG', 'Normal', 'Normal', 'BKK-E1A', '6900695 Patima Donjewprai'),
  ('30678', 'OBS Big C Nakhon Sawan By OPPO', 'Normal', 'Normal', 'Nakhon Sawan', '6701932 Radawan Somsong'),
  ('27908', 'OBS Lotus Banbueng By TG', 'Normal', 'Normal', 'Chon Buri', '6500841 Chotika Laphatsarathanakul'),
  ('27894', 'OBS Central Sriracha FL.2 By OPPO', 'Normal', 'Normal', 'Pattaya 1', '6600541 Jaruwan Kongsiang'),
  ('22982', 'OBS Lotus Thalang FL.1 By Com7', 'Top', 'Non-Benchmark', 'Phuket', 'NO BM'),
  ('29272', 'OBS Robinson Ratchaphruek FL.2 By OPPO', 'Normal', 'Normal', 'BKK-W1A', '6502623 Supichai Thammawongsa'),
  ('25386', 'OBS Lotus Klaeng FL.1 By IT CITY', 'Normal', 'Normal', 'Rayong', '6703051 Maneewan Leerattana'),
  ('31749', 'OBS Central Park FL.4 By OPPO', 'Top', 'BKK by OPPO', 'BKK-E3A', '6801781 Nuttakan Pimbubpha'),
  ('27611', 'OBS Lotus Amatanakorn By IT CITY', 'Normal', 'Normal', 'Chon Buri', '6401111 Wannisorn Jituthat'),
  ('28620', 'OBS Robinson Sriracha FL.2 By OPPO', 'Normal', 'Normal', 'Pattaya 1', '6402213 Aeksichon Nontasen'),
  ('31413', 'OBS Robinson Surin FL.2 By TG', 'Normal', 'Normal', 'Surin', '6600070 Kotchaporn Saenpluem'),
  ('28385', 'OBS Robinson Srisamarn FL.2 By OPPO', 'Normal', 'Normal', 'BKK-W1A', '6600028 Nanpapat Varanitiset'),
  ('24365', 'OBS Central RAMA9 FL.B By OPPO', 'Top', 'BKK by OPPO', 'BKK-E4C', '6105204 Thimontri Loedkrai'),
  ('26533', 'OBS Market Village Huahin FL.3 By IT CITY', 'Normal', 'Normal', 'Prachuap Khiri Khan', 'NO BM'),
  ('27124', 'OBS Robinson Samutprakarn FL.3F By Com7', 'Normal', 'Normal', 'BKK-E2B', 'NO BM'),
  ('27125', 'OBS Robinson Suphanburi By Com7', 'Normal', 'Normal', 'Suphan Buri', 'NO BM'),
  ('27122', 'OBS Central Mahachai FL.2 By Com7', 'Normal', 'Normal', 'BKK-W2B', '5901193 Donthanathon Thunprakhon'),
  ('20585', 'OBS Sahathai Nakhon Si Thammarat FL.3 By Ismart', 'Normal', 'Normal', 'Nakhon Si Thammarat', '6900730 Thanathip Thammarak'),
  ('26535', 'OBS Robinson Borwin FL.2 By IT City', 'Normal', 'Normal', 'Pattaya 2', '6601778 Kamonwan Khongseen'),
  ('23590', 'OBS Big C Suwinthawong FL.2 By Phechduang', 'Normal', 'Normal', 'BKK-E4A', '6802134 Jirawat Sae-tia'),
  ('27370', 'OBS Ayutthaya City Park By TG 2', 'Normal', 'Normal', 'Ayutthaya', '6800956 Jerasak Supakit'),
  ('26706', 'OBS Big C Suksawat By Com7', 'Top', 'Non-Benchmark', 'BKK-W2A', 'NO BM'),
  ('21808', 'OBS Lotus Klongluong By Com7', 'Top', 'Non-Benchmark', 'BKK-E1A', 'NO BM'),
  ('31933', 'OBS Big C Kamphaengphet FL.G By Sub Perm Poon', 'Normal', 'Normal', 'Nakhon Sawan', '6106053 Wanusnun Luangprathum'),
  ('30529', 'OBS Lotus Bowin By IT CITY', 'Normal', 'Normal', 'Pattaya 2', '6010453 Camnuan Janthayung'),
  ('19408', 'OBS Big C Phrae By IT CITY', 'Top', 'Non-Benchmark', 'Phayao', '5701761 Nanucha Thungprasitchok'),
  ('31621', 'OBS Siam TV Chomthong By Siam TV', 'Normal', 'Normal', 'Mae Hong Son', 'NO BM'),
  ('30196', 'OBS Big C Tak By Com7', 'Top', 'Non-Benchmark', 'Sukhothai', '5701707 Suparat Gawtung'),
  ('29858', 'OBS Central Festival Chiangmai FL.3 By OPPO', 'Normal', 'Normal', 'Chiang Mai', '6206358 Wallapa Sida'),
  ('27368', 'OBS Taweekit Buriram By TG', 'Top', 'Non-Benchmark', 'Buriram', 'NO BM'),
  ('27837', 'OBS Taweekit Buriram By TG 2', 'Normal', 'Normal', 'Buriram', '6401378 Kanyaphat Poompuang'),
  ('31731', 'OBS Lotus Uttaradit FL.1 By Com7', 'Normal', 'Normal', 'Phitsanulok', '6702967 Sirilak Pananon'),
  ('25610', 'OBS Central World FL.5 By OPPO', 'Top', 'Benchmark', 'BKK-E3A', '6002265 Tharinya Srisawat'),
  ('24543', 'OBS Big C Rama 4 By K K Mobile', 'Normal', 'Normal', 'BKK-E3B', '6302088 Gunniga Srejaras'),
  ('32281', 'OBS Lotus Yasothon FL.G by First Phone', 'Normal', 'Normal', 'Yasothon', '6900204 Kittiyani Sirisombut'),
  ('23615', 'OBS Lotus Maptapud By Phonepro', 'Normal', 'Normal', 'Rayong', NULL),
  ('32304', 'OBS Market Village Huahin FL.3 By IT CITY 2', 'Normal', 'Normal', 'Prachuap Khiri Khan', '6010686 Suntree Khaensa'),
  ('22663', 'OBS Big C Sa Kaeo By Itech', 'Normal', 'Normal', 'Prachin Buri', '6401883 Amornrat Turata'),
  ('25391', 'OBS Central Westgate FL.2 By OPPO', 'Top', 'Benchmark', 'BKK-W1B', '5702019 Sunisa Chumpetch'),
  ('20789', 'OBS Big C Kanchanaburi By VTEC', 'Normal', 'Normal', 'Kanchanaburi', '6302526 Pornticha Sirikomen'),
  ('28697', 'OBS Lotus Salaya By OPPO', 'Normal', 'Normal', 'Nakhon Pathom', '5903154 Chitsanupong Watchawna'),
  ('3050', 'OBS Harbor Mall Laemchabang FL.2 By LCB Mobile Supply', 'Normal', 'Normal', 'Pattaya 1', 'NO BM'),
  ('27784', 'OBS Lotus Krabi By OPPO', 'Top', 'Non-Benchmark', 'Trang', '6401844 Aomjai Budkrim'),
  ('21081', 'OBS Big C Sukhothai FL.1 By S.R.A. Telecom', 'Top', 'Non-Benchmark', 'Sukhothai', '5500498 Yodkhuan Rodkasa'),
  ('30356', 'OBS Robinson Sakon Nakhon By OPPO', 'Normal', 'Normal', 'Sakon Nakhon', '5902384 Saowalak Praking'),
  ('31420', 'OBS Terminal 21 Korat FL.3 By OPPO', 'Normal', 'Normal', 'Nakhon Ratchasima', '6701815 Wichuda Thongdee'),
  ('3054', 'OBS Robinson Chanthaburi FL.B By Apple Bangkok', 'Normal', 'Normal', 'Chanthaburi', '5600338 Autan Boonpok'),
  ('29422', 'OBS Central Airport Chiangmai FL.3 By OPPO', 'Normal', 'Normal', 'Chiang Mai', '6700341 Suchada Phosae'),
  ('7929', 'OBS Surin Plaza FL.1 By Yongkiet', 'Normal', 'Normal', 'Surin', '5701563 Rijara Ninlamai'),
  ('25389', 'OBS Central Chonburi FL.2 By OPPO', 'Normal', 'Normal', 'Chon Buri', '6801153 Aissaralak Chaipa'),
  ('24958', 'OBS Sermthai Complex FL.2 By Yu Business', 'Normal', 'Normal', 'Roi Et', '6103441 Surawut Chamnan'),
  ('29981', 'OBS Big C Pattani FL.G By OPPO', 'Normal', 'Normal', 'Yala', '6204181 Nurrrya Beybahem'),
  ('23669', 'OBS Siam TV Lampang By Siam TV', 'Normal', 'Normal', 'Lampang', 'NO BM'),
  ('27755', 'OBS Sermthai Mahasarakham By OPPO 2', 'Normal', 'Normal', 'Roi Et', '6801482 Duanghathai Phuartsung'),
  ('9009', 'OBS Central Ubon Ratchathani FL.2 By OPPO', 'Normal', 'Normal', 'Ubon Ratchathani', '6003627 Sunisa Phumaenam'),
  ('31754', 'OBS Big C Mahachai By JP Store', 'Top', 'Non-Benchmark', 'BKK-W2B', '6900413 Sinsupa Sriboonma'),
  ('25417', 'OBS Central Phuket By OPPO', 'Top', 'Non-Benchmark', 'Phuket', '6501306 Mareeya Saman'),
  ('31448', 'OBS Top Plaza Phichit By NCM Smart Phone', 'Normal', 'Normal', 'Lop Buri', '6005589 Teeralak Jantharamanon'),
  ('27789', 'OBS Market Village Suwannaphum By OPPO', 'Top', 'Benchmark', 'BKK-E2C', '6004854 Haruthai Kaewphiphop'),
  ('29396', 'OBS Ayutthaya City Park By Gadget Phone', 'Top', 'Non-Benchmark', 'Ayutthaya', '6700067 Nattanicha Kullapattananan'),
  ('30282', 'OBS Robinson Saraburi FL.2 By OPPO', 'Top', 'Benchmark', 'Saraburi', '6900646 Prawpan Khummol'),
  ('19898', 'OBS Big C Lopburi By J.I.', 'Top', 'Non-Benchmark', 'Lop Buri', '5901877 Chayanan Marat'),
  ('28194', 'OBS Central Salaya FL.2 By OPPO', 'Top', 'Benchmark', 'Nakhon Pathom', '6501946 Supawan Butdeesak'),
  ('22057', 'OBS The Mall Korat By 8 Global Corporation', 'Top', 'Non-Benchmark', 'Nakhon Ratchasima', '6802201 Phattharawadi Nankrathok'),
  ('29690', 'OBS Big C Angthong By OPPO', 'Normal', 'Normal', 'Ayutthaya', '6501588 Juthatip Kamenjan'),
  ('19092', 'OBS Big C Phitsanulok FL.2 By Number one telecom', 'Normal', 'Normal', 'Phitsanulok', '5902974 Chaloempon Imchom'),
  ('8586', 'OBS Central Udonthani FL.2 By OPPO', 'Top', 'Benchmark', 'Udon Thani', '5802386 Nuchalee Kunapatee'),
  ('21067', 'OBS Sahathai Thungsong FL.3 By INTERCOM', 'Normal', 'Normal', 'Nakhon Si Thammarat', '6601723 Sarayut Srisiri'),
  ('28374', 'OBS Big C Udonthani By OPPO', 'Normal', 'Normal', 'Udon Thani', '6301589 Suksan Nammontri'),
  ('25051', 'OBS Robinson Trang By Twinsun', 'Normal', 'Normal', 'Trang', '6200626 Narongsak Chomphookot'),
  ('18127', 'OBS Imperial World Samrong FL.4 By OPPO 1', 'Top', 'BKK by OPPO', 'BKK-E2A', '6700594 Chindarat Chaengtakun'),
  ('12140', 'OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT', 'Normal', 'Normal', 'Nakhon Si Thammarat', '6003250 Warut Thongthip'),
  ('29737', 'OBS Big C Bang Phli By OPPO', 'Normal', 'Normal', 'BKK-E2B', '6300339 Junya Aomchat'),
  ('19003', 'OBS Robinson Kanchanaburi FL.2 By VTEC', 'Normal', 'Normal', 'Kanchanaburi', '6500655 Tatiya Khonpiwkling'),
  ('29113', 'OBS Central Pinklao Fl.3 by OPPO', 'Normal', 'Normal', 'BKK-W1A', '6500062 Napatson Pukpat'),
  ('26346', 'OBS Imperial World Samrong FL.4 By OPPO 2', 'Normal', 'Normal', 'BKK-E2A', '6501761 Sansai Sanjinda'),
  ('30195', 'OBS Central Lampang By Com7', 'Normal', 'Normal', 'Lampang', '5904307 Chawannoot Jai In'),
  ('29159', 'OBS Robinson Thalang By OPPO', 'Normal', 'Normal', 'Phuket', '6500858 Kanut Khamchuea'),
  ('18411', 'OBS Mega Bangna FL.2 By Com7', 'Top', 'Non-Benchmark', 'BKK-E2A', 'NO BM'),
  ('971', 'OBS Future Park Rangsit FL.2 By OPPO', 'Normal', 'Normal', 'BKK-E1A', '6802400 Narumon Yentang'),
  ('26531', 'OBS Lotus Nongbualamphu FL.1 By IT CITY', 'Normal', 'Normal', 'Loei', '6700496 Wutthipong Hompromma'),
  ('28649', 'OBS Robinson Banchang FL.2 By OPPO', 'Normal', 'Normal', 'Rayong', '6900244 Sasiya Thawongklang'),
  ('26528', 'OBS Robinson Lopburi FL.2 By IT CITY', 'Top', 'Non-Benchmark', 'Lop Buri', '6700799 Aoruma Suporn'),
  ('28650', 'OBS Robinson Chachoengsao FL.2F By OPPO', 'Normal', 'Normal', 'Chachoengsao', '6701441 Narachan Ploymanee'),
  ('28327', 'OBS Lotus Pathum Thani By IT CITY', 'Top', 'Non-Benchmark', 'BKK-W1C', '6701931 Rattana Hankla'),
  ('27627', 'OBS The Mall Bangkapi FL.2 By OPPO', 'Top', 'Benchmark', 'BKK-E4A', '6204546 Surasak Janmeta'),
  ('27367', 'OBS Central Korat FL.2 By TG', 'Top', 'Non-Benchmark', 'Nakhon Ratchasima', '5900920 Ghakkapong Sriwatthanapong'),
  ('29745', 'OBS Central Ladprao FL.2 By OPPO', 'Normal', 'Normal', 'BKK-E4C', '6601327 Tammanoon Pornsipark'),
  ('17579', 'OBS Lotus Plusmall Bangyai FL.1 By Com7', 'Top', 'Non-Benchmark', 'BKK-W1A', '6303925 Preecha Pooleay'),
  ('27754', 'OBS Robinson Buriram By OPPO', 'Normal', 'Normal', 'Buriram', '6600561 Adirek Thumaiaroen'),
  ('23713', 'OBS Fasion Island FL.3 By Com7', 'Normal', 'Normal', 'BKK-E4B', '6800557 Naree Sarapraphai'),
  ('29114', 'OBS Lotus Songkhla By OPPO', 'Normal', 'Normal', 'Songkhla', '6501947 Wiritphon Chinnawong'),
  ('29855', 'OBS Lotus Navanakorn By IT CITY', 'Normal', 'Normal', 'BKK-E1A', '6701508 Wannipa Padungrut'),
  ('19704', 'OBS The Mall Tha Phra FL.3 By OPPO', 'Top', 'BKK by OPPO', 'BKK-E3C', '5700003 Chonlatee Tisapark'),
  ('27896', 'OBS Lotus Aranyaprathet FL.1 By OPPO', 'Normal', 'Normal', 'Prachin Buri', '6602542 Khanittha Thongso'),
  ('27345', 'OBS Lotus Pak Chong FL.2 By Com7', 'Normal', 'Normal', 'Nakhon Ratchasima', 'NO BM'),
  ('29496', 'OBS Lotus Nongjok By OPPO', 'Normal', 'Normal', 'BKK-E1B', '6502760 Aekkasit Sonnukij'),
  ('28799', 'OBS Central Westgate By TG', 'Normal', 'Normal', 'BKK-W1B', '6301324 Chakkaphan Prathip'),
  ('29039', 'OBS Central Phitsanulok By OPPO 2', 'Normal', 'Normal', 'Phitsanulok', '6502382 Chirasak Intha'),
  ('20196', 'OBS Robinson Mukdahan FL.2 By Com7', 'Normal', 'Normal', 'Yasothon', 'NO BM'),
  ('28882', 'OBS Central Chanthaburi FL.1 By OPPO', 'Top', 'Non-Benchmark', 'Chanthaburi', '6400053 Kawisara Ngamkham'),
  ('32687', 'OBS Central Chiang Rai FL.1 By OPPO', 'Normal', 'Normal', 'Chiang Rai', '6003925 Panadda Wongpieng'),
  (NULL, 'OBS Central Northville FL.2 By OPPO 1', 'Normal', 'Normal', 'BKK-W1B', NULL),
  ('30538', 'OBS Central Phitsanulok By Hengcharoen Phitsanulok', 'Normal', 'Normal', 'Phitsanulok', '6701532 Yuenyong Choeilomkham'),
  ('18572', 'OBS CK Plaza By LCB Mobile Supply', 'Top', 'Non-Benchmark', 'Rayong', '6702753 Kanokwan Bunphob'),
  ('22535', 'OBS Siam TV Lamphun By Siam TV', 'Normal', 'Normal', 'Lampang', 'NO BM'),
  ('28220', 'OBS Harbor Mall Laemchabang By LCB Mobile Supply 2', 'Normal', 'Normal', 'Pattaya 1', '6010701 Gorrawan Homluea'),
  ('30968', 'OBS Lotus Phatthalung By Tangjai', 'Normal', 'Normal', 'Nakhon Si Thammarat', '6702988 Achittaphon Duanghai')
)
UPDATE "StoreMaster" AS sm
SET
  "dashboardTier" = profile."dashboardTier",
  "kpiPlan" = profile."kpiPlan",
  "dashboardArea" = profile."dashboardArea",
  "bmName" = profile."bmName"
FROM profile
WHERE
  (
    profile."storeId" IS NOT NULL
    AND sm."externalStoreId" = profile."storeId"
  )
  OR
  (
    profile."storeId" IS NULL
    AND sm."storeName" = profile."storeName"
  );

CREATE INDEX IF NOT EXISTS "StoreMaster_dashboardTier_idx" ON "StoreMaster"("dashboardTier");
CREATE INDEX IF NOT EXISTS "StoreMaster_kpiPlan_idx" ON "StoreMaster"("kpiPlan");
CREATE INDEX IF NOT EXISTS "StoreMaster_dashboardArea_idx" ON "StoreMaster"("dashboardArea");
CREATE INDEX IF NOT EXISTS "StoreMaster_bmName_idx" ON "StoreMaster"("bmName");
