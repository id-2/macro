import { contactRecordKey } from '@queries/contacts/contact-key';
import type { ContactReferencePageQueryVariables } from '@service-storage/graphql/generated/graphql';
import { createSignal } from 'solid-js';

const people = [
  {
    userId: 'rox|late@example.com',
    email: 'late@example.com',
    name: 'Late Person',
  },
  {
    userId: 'rox|one@example.com',
    email: 'one@example.com',
    name: 'Ambiguous One',
  },
  {
    userId: 'rox|two@example.com',
    email: 'two@example.com',
    name: 'Ambiguous Two',
  },
  {
    userId: 'rox|comma@example.com',
    email: 'comma@example.com',
    name: 'Family, Given',
  },
  {
    userId: 'rox|alias@example.com',
    email: 'alias@example.com',
    name: 'target@example.com',
  },
];
export const [referenceRequests, setReferenceRequests] = createSignal<
  ContactReferencePageQueryVariables[]
>([]);
export async function fetchContactReferencePage(
  variables: ContactReferencePageQueryVariables,
  signal: AbortSignal
) {
  signal.throwIfAborted();
  setReferenceRequests((old) => [...old, variables]);
  if (!variables.search) throw new Error('Reference search is required');
  const label = variables.search.toLowerCase();
  const viewer = 'rox|viewer@example.com';
  return {
    user: {
      id: viewer,
      contacts: {
        nodes: variables.after
          ? people
              .filter((person) => {
                const name = person.name.toLowerCase();
                return variables.matching === 'FIRST_NAME'
                  ? name.split(' ')[0] === label
                  : name === label;
              })
              .map((person) => ({
                ...person,
                id: contactRecordKey(viewer, person.userId).slice(
                  'GraphqlContact:'.length
                ),
              }))
          : [],
        nextCursor: variables.after ? null : 'after-empty-budget',
      },
    },
  };
}
