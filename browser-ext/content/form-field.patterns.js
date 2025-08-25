export const Patterns = {
            'first_name': /first.?name|fname|given.?name/,
            'last_name': /last.?name|lname|surname|family.?name/,
            'full_name': /full.?name|name(?!.*email)(?!.*user)/,
            'email': /email|e.?mail/,
            'phone': /phone|tel|mobile|cell/,
            'address': /address|addr(?!ess)/,
            'city': /city|town/,
            'state': /state(?!ment)|province|region/,
            'zip': /zip|postal|post.?code/,
            'country': /country|nation/,
            'company': /company|organization|employer/,
            'position': /position|title|job.?title|role/,
            'website': /website|url|site/,
            'linkedin': /linkedin|linked\.in/,
            'github': /github|git\.hub/,
            'experience': /experience|exp|years/,
            'education': /education|degree|school|university|college/,
            'skills': /skills|skill|competenc/,
            'cover_letter': /cover.?letter|motivation|why/,
            'salary': /salary|compensation|pay|wage/,
            'date': /date|when|time/
        };

export default Patterns;