import { expect } from 'chai';
import { createFittFinderApi } from '../src/FittFinderApi';
import { buildMutation, buildQuery } from '../src/graphql';

describe('index', () => {
  const effectivePermissions = new Set<string>();
  const hasPermission = (perm: string): boolean => {
    return effectivePermissions.has('SUPER') || effectivePermissions.has(perm);
  };

  it('queries self', async function () {
    const api = createFittFinderApi();
    const res = await api.apiRequest({ query: 'query { self { id name effectivePermissions } }' });
    expect(res.errors).to.be.undefined;
    expect(res.data.self.id).to.be.a('string');
    expect(res.data.self.name).to.be.a('string');
    expect(res.data.self.effectivePermissions).to.be.an('array');
    res.data.self.effectivePermissions.forEach((perm: string) => effectivePermissions.add(perm));
    console.log(effectivePermissions);
  });

  it('queries event instances', async function () {
    if (!hasPermission('SEARCH_EVENTS')) {
      return this.skip();
    }

    const api = createFittFinderApi();
    const res = await api.apiRequest(
      buildQuery(
        'eventInstances',
        { simpleQuery: 'String' },
        { simpleQuery: 'yoga' },
        'nodes { id startDate event { name } }'
      )
    );
    expect(res.errors).to.be.undefined;
    console.log(res.data.eventInstances.nodes.map((n: any) => `${n.id}: ${n.event.name} @ ${n.startDate}`));
  });

  let eventId: string;
  it('creates an event', async function () {
    if (!hasPermission('CREATE_EVENT')) {
      return this.skip();
    }

    const api = createFittFinderApi();
    const res = await api.apiRequest(
      buildMutation(
        'createEvent',
        {
          private: 'Boolean!',
          name: 'String!',
          description: 'String',
          attendance: 'AttendanceType',
          formatId: 'ID!',
          categoryIds: '[ID!]',
          firstStart: 'DateTime!',
          lastEnd: 'DateTime',
          recurrenceRule: 'String',
          registrationUrl: 'URI',
          paymentType: 'PaymentType',
          currency: 'String',
          listPrice: 'Int'
        },
        {
          private: false,
          name: 'My MWF Workout',
          description: 'A very good all-ages workout three days a week!',
          attendance: 'VIRTUAL',
          formatId: 'class',
          categoryIds: ['fitness/aerobics', 'fitness/stretching', 'age/all'],
          firstStart: '2022-01-03T18:00:00Z',
          lastEnd: '2022-04-01T19:00:00Z',
          recurrenceRule:
            'DTSTART:20220103T180000Z\nDURATION:PT1H\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20220401T190000Z',
          registrationUrl: 'https://example.com/my-mwf-workout/register',
          paymentType: 'FIXED_PRICE',
          currency: 'USD',
          listPrice: 1000
        },
        'event { id }'
      )
    );
    expect(res.errors).to.be.undefined;
    console.log(res.data.createEvent.event);
    eventId = res.data.createEvent.event.id;
    expect(eventId).to.be.a('string');
  });

  it('deletes an event', async function () {
    if (!eventId) {
      return this.skip();
    }

    const api = createFittFinderApi();
    const res = await api.apiRequest(buildMutation('deleteEvent', { id: 'ID!' }, { id: eventId }, 'deleted'));
    expect(res.errors).to.be.undefined;
    console.log(res.data.deleteEvent);
    expect(res.data.deleteEvent.deleted).to.be.true;
  });
});
