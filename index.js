console.log("Executing program");

const PORT = process.env.PORT || 8810;
// const PORT = 8810;
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

const campuses = ["rocklin", "nevada", "ncc", "distance", "tahoe-truckee", "tahoe", "truckee", "roseville"];
const campusIDs = [10, 20, 20, 80, 40, 40, 40, 30];

function removeExtraSpaces(string){
	var out = string.replace(/\s{2,}/g, ' ')
	return out.trim()
}

function termsEqual(term1, term2){
	var days1 = term1.meetingDays.join('')
	var days2 = term2.meetingDays.join('')
	return days1 == days2 &&
		term1.meetingTimes == term2.meetingTimes && 
		term1.classroom == term2.classroom && 
		term1.date == term2.date
}

function removeSameTerms(termArray){
	for (let i = termArray.length - 2; i >= 0; i--)
		if (termsEqual(termArray[i], termArray[i+1]))
			termArray.splice(i, 1);
	return termArray;
}

function getID(param) {
	var lower = param.toLowerCase();
	for (var i = 0; i < campuses.length; i++)
		if (campuses[i] == lower) return campusIDs[i];
	return "%25";
}

function defaultMessage(res) {
	res.status(404);
	res.json([
		"Usage: /<year>/<term>/<campus><headers>",
		"Use at least one header: subj: 2-4 letter subject ID | course: number of course | crn: 5-digit course number | title: name of course",
		"fname and lname: First and last names, if searching by professor. Both are necessary.",
		"Examples: /2022/fall/rocklin?subj=csci&course=13   /2023/spring/rocklin?fname=barry&lname=brown&title=discrete%20structures",
	]);
}
function errorMessage(res) {
	res.status(404);
	res.json(["An error occurred. Check your year and term."]);
}

//No params case: API usage
app.get("/", (req, res) => {
	defaultMessage(res);
});
app.get("/:1", (req, res) => {
	defaultMessage(res);
});
app.get("/:1/:2", (req, res) => {
	defaultMessage(res);
});

app.get("/:year/:term/:campus", (req, res) => {
	var term = req.params.year;
	switch (req.params.term.toLowerCase()) {
		case "fall":
		case "autumn":
			term += "80";
			break;
		case "summer":
			term += "60";
			break;
		case "spring":
			term += "40";
			break;
	}

	var campus = getID(req.params.campus);

	var count = 0;
	var subj = "";
	var course = "";
	var crn = "";
	var title = "";

	if (req.query.subj != null) {
		subj = req.query.subj.toUpperCase();
		count++;
	}
	if (req.query.course != null) {
		course = req.query.course.toLowerCase();
		count++;
	}
	if (req.query.crn != null) {
		crn = req.query.crn.toLowerCase();
		count++;
	}
	if (req.query.title != null) {
		title = req.query.title.toLowerCase();
		count++;
	}
	if (req.query.fname != null && req.query.lname != null) {
		var fname = req.query.fname.toLowerCase();
		var lname = req.query.lname.toLowerCase();
		count++;

		professorCall(term, campus, subj, course, crn, title, fname, lname, res);
		return;
	}
	if (count === 0) {
		defaultMessage(res);
		return;
	}

	finalCall(term, campus, "%25", subj, course, crn, title, res);
}); //END GET METHOD

function professorCall(term, campus, subj, course, crn, title, fname, lname, res) {
	var requestURL =
		"https://ssb.sierracollege.edu:8810/PROD/pw_sigsched.p_Search?term=" + term + "&p_campus=" + campus;

	axios.get(requestURL).then((response) => {
		const data = response.data;
		const html = cheerio.load(data);
		var found = false;
		html("select", data).each(function (i, table) {
			if (html(this).attr("name") == "sel_instr") {
				html("option", table).each(function () {
					if (html(this).attr("value") != "%") {
						var array = html(this).text().toLowerCase().split(", ");

						if (array[1].includes(fname) && array[0].includes(lname)) {
							// console.log("Found professor");
							found = true;
							finalCall(term, campus, html(this).attr("value"), subj, course, crn, title, res);
							return;
						}
					}
				});
				if (!found) {
					res.json([]);
				}
			}
		});
	})
	.catch(err=>{
		console.log("Error occurred")
		console.log(requestURL)
		errorMessage(res)
	})
}

function finalCall(term, campus, instructor, subj, course, crn, title, res) {
	var requestURL =
		"https://ssb.sierracollege.edu:8810/PROD/pw_sigsched.p_process?TERM=" +
		term +
		"&TERM_DESC=&sel_subj=&sel_day=&sel_schd=&p_camp=" +
		campus +
		"&sel_ism=&sel_sess=&sel_instr=&sel_ptrm=&sel_attr=&sel_subj=" +
		subj +
		"&sel_crse=" +
		course +
		"&sel_crn=" +
		crn +
		"&sel_title=" +
		title +
		"&aa=N&begin_hh=5&begin_mi=0&begin_ap=a&end_hh=11&end_mi=0&end_ap=p&sel_instr=" +
		instructor +
		"&sel_ism=%25&sel_ptrm=%25&sel_attr=%25";
	axios.get(requestURL).then((response) => {
		const data = response.data;
		const html = cheerio.load(data);

		var responseArray = [];
		var returnedData = [];

		html("tr", data).each(function (i, row) {
			//For each row,
			var currentRow = [];
			html("td", row).each(function (j, innerRow) {
				//read it's data.
				var currentText = html(this).text();
				html("a", innerRow).each(function () {
					//read it's data.
					if (html(this).text() == "Book Info") currentText = html(this).attr("href");
				}); //End inner foreach
				html("img", innerRow).each(function () {
					//read it's data.
					currentText = html(this).attr("alt");
				}); //End inner foreach
				currentRow.push(currentText);
			}); //End inner foreach
			returnedData.push(currentRow);
		}); //End outer foreach

		var className = returnedData[0]; //course topic (CS12, CS13, etc)
		var currentCourse = []; //current course being updated

		for (var i = 0; i < returnedData.length; i++) {
			var course = returnedData[i]; //current row
			if (course[0] == "Status") continue;
			if (
				course.length === 1 &&
				course[0].trim().substring(0, 2) == course[0].trim().substring(0, 2).toUpperCase()
			) {
				className = course[0];
				continue;
			}

			if (
				course[0] == "Available" ||
				course[0] == "Waitlisting" ||
				course[0] == "Full" ||
				course[0] == "Closed"
			) {
				if (currentCourse.length > 0) {
					if (currentCourse.length < 14) currentCourse.push("");
					responseArray.push(currentCourse);
				}
				currentCourse = [];

				currentCourse.push(className);
				var index;
				for (index = 0; index < 4; index++) {
					currentCourse.push(course[index].trim());
				}
				currentCourse.push([]);
				var times = [];
				if (course.length == 20) {
					for (let timeIndex = 4; timeIndex < 13; timeIndex++) {
						var trimmed = course[timeIndex].trim();
						if (trimmed != "") times.push(trimmed);
					}
				} else {
					times.push(course[4]);
					times.push(course[5]);
				}
				if (course.length == 20) times.push(course[17]);
				else times.push(course[10]);
				currentCourse[5].push(times);

				if (course.length == 13) {
					for (index = 6; index < 13; index++) {
						currentCourse.push(course[index]);
					}
				} else {
					for (index = 13; index < 20; index++) {
						currentCourse.push(course[index]);
					}
				}

				i++;
				if (i >= returnedData.length) break;
				course = returnedData[i];
				while (course.length == 8 || course.length == 15) {
					var otherTimes = [];
					if (course.length == 15) {
						for (let ind = 1; ind < 10; ind++) {
							var trimmed = course[ind].trim();
							if (trimmed != "") otherTimes.push(trimmed);
						}
						otherTimes.push(course[12]);
					} else {
						for (let ind = 1; ind < 3; ind++) {
							var trimmed = course[ind].trim();
							if (trimmed != "") otherTimes.push(trimmed);
						}
						otherTimes.push(course[5]);
					}

					currentCourse[5].push(otherTimes);
					i++;
					if (i >= returnedData.length) break;
					course = returnedData[i];
					if (
						course.length == 1 &&
						course[0].trim().substring(0, 2) != course[0].trim().substring(0, 2).toUpperCase()
					) {
						currentCourse.push(course[0].trim());
						continue;
					}
				}
				i--;
			}
		}
		if (currentCourse.length > 0) {
			if (currentCourse.length < 14) currentCourse.push("");
			responseArray.push(currentCourse);
		}

		var output = [];
		responseArray.forEach((c) => { //For every individual class...
			var session = c[5];
			var timesArray = [];
			session.forEach((element) => {
				var dates = element[element.length - 1]
				var room = element[element.length - 2]
				var times = element[element.length - 3]
				var weekdays = element.slice(0, element.length - 3)
				timesArray.push({
					meetingDays: weekdays,
					meetingTimes: removeExtraSpaces(times),
					classroom: removeExtraSpaces(room),
					date: removeExtraSpaces(dates),
				});
			});

			timesArray.sort((c1, c2)=>{
				var days1 = c1.meetingDays.join('')
				var days2 = c2.meetingDays.join('')

				var comparison = days1.localeCompare(days2);
				if (comparison != 0) return comparison;

				comparison = c1.meetingTimes.localeCompare(c2.meetingTimes);
				if (comparison != 0) return comparison;

				comparison = c1.classroom.localeCompare(c2.classroom);
				if (comparison != 0) return comparison;

				comparison = c1.date.localeCompare(c2.date);
				return comparison;
			})

			timesArray = removeSameTerms(timesArray)

			output.push({
				name: removeExtraSpaces(c[0]),
				status: removeExtraSpaces(c[1]),
				crn: removeExtraSpaces(c[2]),
				cred: removeExtraSpaces(c[3]),
				textbookCost: removeExtraSpaces(c[4]),
				sessions: timesArray,
				max: parseInt(removeExtraSpaces(c[6])),
				enrolled: parseInt(removeExtraSpaces(c[7])),
				waitlisted: parseInt(removeExtraSpaces(c[8])),
				instructor: removeExtraSpaces(c[9]),
				dates: removeExtraSpaces(c[10]),
				weeks: removeExtraSpaces(c[11]),
				book: c[12].trim(),
				notes: c[13].trim(),
			});
		});

		var queryParams = {

		};

		var outputObject = {
			length: output.length,
			data: output,
			parameters: queryParams,
			queryTime: new Date()
		};
		
		res.json(outputObject);
		console.log(requestURL)
		return;
	})
	.catch((err) => {
		console.log("Error parsing")
		console.log(requestURL)
		errorMessage(res)
	});
}
app.listen(PORT, () => console.log("Running on PORT " + PORT));

module.exports = app;