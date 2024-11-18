import { describe, expect, it, jest } from "@jest/globals";
import assert from "assert";
import { createFittFinderApi } from "../src/FittFinderApi.js";
import { buildMutation, buildQuery, isObject } from "../src/graphql.js";

jest.setTimeout(10000);

describe("index", () => {
  const effectivePermissions = new Set<string>();
  const hasPermission = (perm: string): boolean => {
    return effectivePermissions.has("SUPER") || effectivePermissions.has(perm);
  };

  it("queries self", async function () {
    const api = createFittFinderApi();
    const res = await api.apiRequest({
      query: "query { self { id name effectivePermissions } }",
    });
    expect(res.errors).toBeUndefined();
    assert(isObject(res.data));
    assert(isObject(res.data.self));
    expect(res.data.self.id).toStrictEqual(expect.any(String));
    expect(res.data.self.name).toStrictEqual(expect.any(String));
    assert(Array.isArray(res.data.self.effectivePermissions));
    res.data.self.effectivePermissions.forEach((perm: string) =>
      effectivePermissions.add(perm)
    );
    console.log(effectivePermissions);
  });

  it("queries event instances", async function () {
    if (!hasPermission("SEARCH_EVENTS")) {
      console.log(
        "Skipping test because user doesn't have permission to search events"
      );
      return;
    }

    const api = createFittFinderApi();
    const res = await api.apiRequest(
      buildQuery(
        "eventInstances",
        { query: "String" },
        { query: "yoga" },
        "nodes { id startDate event { name } }"
      )
    );
    expect(res.errors).toBeUndefined();
    assert(isObject(res.data));
    assert(isObject(res.data.eventInstances));
    assert(Array.isArray(res.data.eventInstances.nodes));
    console.log(
      res.data.eventInstances.nodes.map(
        (n: { id: string; event: { name: string }; startDate: string }) =>
          `${n.id}: ${n.event.name} @ ${n.startDate}`
      )
    );
  });

  let eventId: string;
  it("creates an event", async function () {
    if (!hasPermission("CREATE_EVENT")) {
      console.log(
        "Skipping test because user doesn't have permission to create events"
      );
      return;
    }

    const api = createFittFinderApi();
    const res = await api.apiRequest(
      buildMutation(
        "createEvent",
        {
          private: "Boolean!",
          name: "String!",
          description: "String",
          attendance: "AttendanceType",
          formatId: "ID!",
          categoryIds: "[ID!]",
          firstStart: "DateTime!",
          lastEnd: "DateTime",
          recurrenceRule: "String",
          registrationUrl: "URI",
          paymentType: "PaymentType",
          currency: "String",
          listPrice: "Int",
        },
        {
          private: false,
          name: "My MWF Workout",
          description: "A very good all-ages workout three days a week!",
          attendance: "VIRTUAL",
          formatId: "class",
          categoryIds: ["fitness/aerobics", "fitness/stretching", "age/all"],
          firstStart: "2022-01-03T18:00:00Z",
          lastEnd: "2022-04-01T19:00:00Z",
          recurrenceRule:
            "DTSTART:20220103T180000Z\nDURATION:PT1H\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20220401T190000Z",
          registrationUrl: "https://example.com/my-mwf-workout/register",
          paymentType: "FIXED_PRICE",
          currency: "USD",
          listPrice: 1000,
        },
        "event { id }"
      )
    );
    expect(res.errors).toBeUndefined();
    assert(isObject(res.data));
    assert(isObject(res.data.createEvent));
    assert(isObject(res.data.createEvent.event));
    assert(typeof res.data.createEvent.event.id === "string");
    eventId = res.data.createEvent.event.id;
  });

  it("deletes an event", async function () {
    if (!eventId) {
      console.log("Skipping test because eventId wasn't set");
      return;
    }

    const api = createFittFinderApi();
    const res = await api.apiRequest(
      buildMutation("deleteEvent", { id: "ID!" }, { id: eventId }, "deleted")
    );
    expect(res.errors).toBeUndefined();
    assert(isObject(res.data));
    assert(isObject(res.data.deleteEvent));
    console.log(res.data.deleteEvent);
    expect(res.data.deleteEvent.deleted).toBe(true);
  });
});
