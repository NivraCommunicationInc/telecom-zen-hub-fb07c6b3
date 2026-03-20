/**
 * StaffBackground - Internal light surface background.
 * Replaces legacy dark animated background for full light UI consistency.
 */
export const StaffBackground = () => {
  return <div className="fixed inset-0 -z-10 bg-background" aria-hidden="true" />;
};

export default StaffBackground;
