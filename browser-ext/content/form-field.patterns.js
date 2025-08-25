export const Patterns = {
            'first_name': /first.?name|fname|given.?name/,
            'last_name': /last.?name|lname|surname|family.?name/,
            'full_name': /\bfull.?name\b|\bname\b(?!.*\b(?:email|user(?:name)?)\b)/,
            'email': /email|e.?mail/,
            'phone': /phone|tel|mobile|cell/,
            'address': /address|addr(?!ess)/,
            'city': /city|town/,
            'state': /state(?!ment)|province|region/,
            'zip': /\b(?:zip(?:\s*code)?|postal(?:\s*code)?)\b/,
            'country': /country|nation/,
            'company': /company|organization|employer/,
            'position': /position|title|job.?title|role/,
            'website': /\b(?:website|url|homepage)\b/,
            'linkedin': /linkedin|linked\.in/,
            'github': /github|git\.hub/,
            'experience': /\b(?:experience|exp|years?\s+of\s+experience|yoe)\b/,
            'education': /education|degree|school|university|college/,
            'skills': /\b(?:skills?|competenc\w*)\b/,
            'cover_letter': /cover.?letter|motivation|why/,
            'salary': /salary|compensation|pay|wage/,
            'date': /\b(?:date|dob|start(?:\s*date)?|end(?:\s*date)?|available\s*from)\b/
        };

Object.freeze(Patterns);