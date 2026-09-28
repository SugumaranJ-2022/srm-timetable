/**
 * Formats section name into requested style: e.g. "MCA C" -> "Class - MCA - C"
 * "MCA (Gen AI) A" -> "Class - MCA (Gen AI) - A"
 * "M.Sc. B" -> "Class - M.Sc. - B"
 */
export function formatSectionTitle(secName) {
  if (!secName) return 'Class';
  const trimmed = secName.trim();
  
  // If section ends with single letter section code e.g. "MCA C" or "MCA (Gen AI) A" or "M.Sc. B"
  const match = trimmed.match(/^(.*)\s+([A-E])$/i);
  if (match) {
    return `Class - ${match[1]} - ${match[2].toUpperCase()}`;
  }
  return `Class - ${trimmed}`;
}

/**
 * Maps raw student/staff email prefixes (e.g., "student.mcac", "drpriyasharma") 
 * to clean user-friendly display titles if profile is not fully loaded.
 */
export const EMAIL_TO_DISPLAY_NAME = {
  // Students
  'studentmcaa': 'Class - MCA - A',
  'studentmcab': 'Class - MCA - B',
  'studentmcac': 'Class - MCA - C',
  'studentmcad': 'Class - MCA - D',
  'studentmcae': 'Class - MCA - E',
  'studentmcagenaia': 'Class - MCA (Gen AI) - A',
  'studentmcagenaib': 'Class - MCA (Gen AI) - B',
  'studentmcagenaic': 'Class - MCA (Gen AI) - C',
  'studentmsca': 'Class - M.Sc. - A',
  'studentmscb': 'Class - M.Sc. - B',
  'studentbcaa': 'Class - BCA - A',
  'studentbcab': 'Class - BCA - B',
  'studentbcac': 'Class - BCA - C',
  'studentbcagenaia': 'Class - BCA (Gen AI) - A',
  'studentbcagenaib': 'Class - BCA (Gen AI) - B',
  'studentbcagenaic': 'Class - BCA (Gen AI) - C',

  // Staff
  'drrajeshkumar': 'Dr. Rajesh Kumar',
  'drpriyasharma': 'Dr. Priya Sharma',
  'drarunalagappan': 'Dr. Arun Alagappan',
  'drsandeepgoel': 'Dr. Sandeep Goel',
  'dramitpatel': 'Dr. Amit Patel',
  'drshalinirao': 'Dr. Shalini Rao',
  'drrajeevnair': 'Dr. Rajeev Nair',
  'drnehakapoor': 'Dr. Neha Kapoor',
  'drpreetisen': 'Dr. Preeti Sen',
  'drmanojverma': 'Dr. Manoj Verma',
  'drdivyaiyer': 'Dr. Divya Iyer',
  'drharishjoshi': 'Dr. Harish Joshi',
  'drdeepanair': 'Dr. Deepa Nair',
  'drsuryakumar': 'Dr. Surya Kumar',
  'drfahadhfaasil': 'Dr. Fahadh Faasil',
  'drmaheshbabu': 'Dr. Mahesh Babu',
  'mranandsubramanian': 'Mr. Anand Subramanian',
  'mrvijaykulkarni': 'Mr. Vijay Kulkarni',
  'mrnitingadkari': 'Mr. Nitin Gadkari',
  'mrsanjaydutt': 'Mr. Sanjay Dutt',
  'mrrohanbopanna': 'Mr. Rohan Bopanna',
  'mrtaruntahiliani': 'Mr. Tarun Tahiliani',
  'mrnanighose': 'Mr. Nani Ghose',
  'mrdulquersalmaan': 'Mr. Dulquer Salmaan',
  'msanithadevi': 'Ms. Anitha Devi',
  'msmeenajasmine': 'Ms. Meena Jasmine',
  'mskavitharao': 'Ms. Kavitha Rao',
  'msanjalipatil': 'Ms. Anjali Patil',
  'mssnehareddy': 'Ms. Sneha Reddy',
  'msarchanapuran': 'Ms. Archana Puran',

  // Admin
  'admin': 'Administrator',
};

/**
 * Gets clean formatted display name for current logged-in user or profile.
 */
export function getUserDisplayName(user, profile) {
  if (!user) return 'User';
  
  if (user.role === 'Student') {
    if (profile?.student?.section_name) {
      return formatSectionTitle(profile.student.section_name);
    }
    const pref = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (EMAIL_TO_DISPLAY_NAME[pref]) {
      return EMAIL_TO_DISPLAY_NAME[pref];
    }
    return formatSectionTitle(user.email.split('@')[0]);
  }

  if (user.role === 'Staff') {
    if (profile?.staff?.name) {
      return profile.staff.name;
    }
    const pref = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (EMAIL_TO_DISPLAY_NAME[pref]) {
      return EMAIL_TO_DISPLAY_NAME[pref];
    }
    return user.email.split('@')[0];
  }

  if (user.role === 'Admin') {
    return 'Administrator';
  }

  return user.email.split('@')[0];
}
