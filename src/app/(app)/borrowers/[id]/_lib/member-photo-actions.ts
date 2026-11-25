/**
 * What the member page header offers for the member's photo. Anyone who can
 * open the page can open the photo; uploading, changing and removing it need
 * `borrowers:update`, as the server's photo routes do, like Edit Profile.
 */
export interface MemberPhotoActions {
  /** What clicking the picture does: open the photo, choose one to upload, or nothing. */
  avatar: "view" | "upload" | null;
  /** The camera button that chooses a new photo. */
  change: boolean;
  /** The button that removes the photo. */
  remove: boolean;
}

export function memberPhotoActions(hasPhoto: boolean, canEdit: boolean): MemberPhotoActions {
  return {
    avatar: hasPhoto ? "view" : canEdit ? "upload" : null,
    change: canEdit,
    remove: hasPhoto && canEdit,
  };
}
