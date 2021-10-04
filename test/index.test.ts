import { expect } from 'chai';
import { buildQuery } from '../dist/graphql';
import { createFittFinderApi } from '../src/FittFinderApi';

describe('index', () => {
  it('queries self', async () => {
    const api = createFittFinderApi();
    const res = await api.apiRequest({ query: 'query { self { id name } }' });
    expect(res.errors).to.be.undefined;
    expect(res.data.self.id).to.be.a('string');
    expect(res.data.self.name).to.be.a('string');
  });
  it('queries event instances', async () => {
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
});
