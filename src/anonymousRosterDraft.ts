export type AnonymousRosterPerson = {donorName:string;studentId:string};

/** Exclusions stay visible in the draft until the server confirms the save. */
export function activeAnonymousPeople(
  draft:readonly AnonymousRosterPerson[], excludedIndices:readonly number[]
):AnonymousRosterPerson[] {
  return draft.filter((_,index)=>!excludedIndices.includes(index)).map(person=>({
    donorName:person.donorName.trim(),studentId:person.studentId.trim()
  }));
}

export function hasAnonymousRosterChanges(
  draft:readonly AnonymousRosterPerson[], saved:readonly AnonymousRosterPerson[],
  excludedIndices:readonly number[]
):boolean {
  const effective=activeAnonymousPeople(draft,excludedIndices);
  return effective.length!==saved.length || effective.some((person,index)=>
    person.donorName!==saved[index].donorName || person.studentId!==saved[index].studentId);
}
