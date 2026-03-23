export const gamesTable = new sst.aws.Dynamo("Games", {
  fields: { pk: "string", type: "string", name: "string", boothId: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byType: { hashKey: "type", rangeKey: "name" },
    byBooth: { hashKey: "boothId" },
  },
});

export const exhibitorsTable = new sst.aws.Dynamo("Exhibitors", {
  fields: { pk: "string", kind: "string", name: "string" },
  primaryIndex: { hashKey: "pk" },
  globalIndexes: {
    byKind: { hashKey: "kind", rangeKey: "name" },
  },
});
