export function isUtEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._+-]*@(utexas\.edu|my\.utexas\.edu)$/u.test(email);
}

export const utEmailMessage = "Use your UT Austin email address (@utexas.edu or @my.utexas.edu).";
