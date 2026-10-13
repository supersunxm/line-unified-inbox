// Oct 13 RCA identity-cases-59.csv: all seven confirmed pairs.
// Only source IDs/times retained. Customer IDs, text, record UUIDs and chat IDs removed.
export const liveMirrorIdentityCollisions = [
  {
    "storeCode": "32687",
    "managerId": "635777167095496705",
    "otherManagerId": "635777167480848848",
    "sourceAt": "2026-10-12T05:47:06.003Z",
    "otherAt": "2026-10-12T05:47:06.402Z",
    "canonicalSource": "LINE_MANAGER_MIRROR"
  },
  {
    "storeCode": "32687",
    "managerId": "635777166810022000",
    "otherManagerId": "635777167699738813",
    "sourceAt": "2026-10-12T05:47:06.002Z",
    "otherAt": "2026-10-12T05:47:06.401Z",
    "canonicalSource": "LINE_MANAGER_MIRROR"
  },
  {
    "storeCode": "19704",
    "managerId": "635646506909303353",
    "otherManagerId": "635646510063157505",
    "sourceAt": "2026-10-11T08:09:06.637Z",
    "otherAt": "2026-10-11T08:09:08.378Z",
    "canonicalSource": "AUTO_RESPONSE"
  },
  {
    "storeCode": "19704",
    "managerId": "635056967668728530",
    "otherManagerId": "635056969950167195",
    "sourceAt": "2026-10-07T06:32:33.833Z",
    "otherAt": "2026-10-07T06:32:35.101Z",
    "canonicalSource": "AUTO_RESPONSE"
  },
  {
    "storeCode": "19704",
    "managerId": "635177210764329131",
    "otherManagerId": "635177211469234474",
    "sourceAt": "2026-10-08T02:27:04.167Z",
    "otherAt": "2026-10-08T02:27:04.759Z",
    "canonicalSource": "AUTO_RESPONSE"
  },
  {
    "storeCode": "19704",
    "managerId": "635328379788722912",
    "otherManagerId": "635328381163930251",
    "sourceAt": "2026-10-09T03:28:48.033Z",
    "otherAt": "2026-10-09T03:28:48.847Z",
    "canonicalSource": "AUTO_RESPONSE"
  },
  {
    "storeCode": "32610",
    "managerId": "635054091399594363",
    "otherManagerId": "635054092657623558",
    "sourceAt": "2026-10-07T06:03:59.474Z",
    "otherAt": "2026-10-07T06:04:00.148Z",
    "canonicalSource": "LINE_MANAGER_MIRROR"
  }
] as const;
