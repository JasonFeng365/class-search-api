console.log("Executing program");

const PORT = 8810;
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

function arrayContains(array, param){
    var lower = param.toLowerCase()
    for (var i = 0; i<array.length; i++){
        if (array[i].toLowerCase() == lower) return true
    }
    return false
}

function defaultMessage(res){
  res.json(
    "Usage: /<year>/<term>/<campus>\n" +
      "Headers:    subj: 2-4 letter subject ID  |  course: number of course  |  crn: 5-digit course number  |  title: name of course"+
      "Examples: /2022/fall/rocklin?subj=csci&course=13   /2022/summer/rocklin/csci?course=csci   /2022/summer/rocklin/csci?course=csci"
  );
}

// var fieldNames = ["status", "crn", "cred", "textbookCosts", "times", "classroom", "max", "enrolled", "waitlisted",
// "instructor", "date", "weeks", "books"]

//No params case: API usage
app.get("/", (req, res) => {
  defaultMessage(res)
});

app.get("/:year/:term/:campus", (req, res) => {
    var lowercase = req.params.campus.toLowerCase();

  axios.get("https://ssb.sierracollege.edu:8810/PROD/pw_sigsched.p_Search")
    .then((response) => {
        var term = -1;
        var nextIsNowTerm = false;
        var nowTerm;
        var campus = 'x'
        
        const data = response.data;
        const html = cheerio.load(data);

      html("option", data).each(function () {
        var termAndYear = html(this).text();
        var id = html(this).attr("value");

        var array = termAndYear.split(" ");
        if (
          array[1] == req.params.year &&
          array[0].toLowerCase() == req.params.term.toLowerCase()
        ) {
          term = id;
        }
        if (nextIsNowTerm) {
            nextIsNowTerm = false;
            nowTerm = id;
          }
        if (id == "X") {
          nextIsNowTerm = true;
        }
        if (termAndYear.toLowerCase().includes(lowercase)){
            campus = id;
        }
      });//end foreach
      if (term === -1) term = nowTerm;

      var count = 0
      var subj=''
      var course = ''
      var crn = ''
      var title = ''
      if (req.query.subj != null) {
        subj = req.query.subj.toUpperCase()
        count++
      }
      if (req.query.course != null){
        course = req.query.course.toLowerCase()
        count++
      } 
      if (req.query.crn != null){
        crn = req.query.crn.toLowerCase()
        count++
      }
      if (req.query.title != null) {
        title = req.query.title.toLowerCase()
        count++
      }
      if (count===0){
        defaultMessage(res)
        return
      }

      var requestURL = "https://ssb.sierracollege.edu:8810/PROD/pw_sigsched.p_process?TERM="+term+
      "&TERM_DESC=&sel_subj=&sel_day=&sel_schd=&p_camp="+campus+
      "&sel_ism=&sel_sess=&sel_instr=&sel_ptrm=&sel_attr=&sel_subj="+subj+
      "&sel_crse="+course+"&sel_crn="+crn+"&sel_title="+title+
      "&aa=N&begin_hh=5&begin_mi=0&begin_ap=a&end_hh=11&end_mi=0&end_ap=p&sel_instr=%25&sel_ism=%25&sel_ptrm=%25&sel_attr=%25"
    axios.get(requestURL)
        .then((response) => {
            const data = response.data;
            const html = cheerio.load(data);

            var responseArray = [];
            var returnedData = []

            html("tr", data).each(function (i, row) {//For each row,
              var currentRow = []
              html("td", row).each(function(j, innerRow){//read it's data.
                var currentText = html(this).text()
                  html("a", innerRow).each(function(){//read it's data.
                    if (html(this).text()=="Book Info") currentText = html(this).attr("href")
                })//End inner foreach  
                  html("img", innerRow).each(function(){//read it's data.
                    currentText = html(this).attr("alt")
                })//End inner foreach  
                currentRow.push(currentText)
              })//End inner foreach              
              returnedData.push(currentRow)
            });//End outer foreach

            var className = returnedData[0]; //course topic (CS12, CS13, etc)
            var currentCourse = [] //current course being updated

            
            for (var i = 0; i<returnedData.length; i++){
              var course = returnedData[i] //current row
              if (course[0]=="Status") continue
              if (course.length===1 && course[0].trim().substring(0,2)==course[0].trim().substring(0,2).toUpperCase()) {
                className = course[0]
                continue
              }

              if (course[0]=="Available" || course[0]=="Waitlisting" || course[0]=="Full" || course[0]=="Closed"){
                if (currentCourse.length>0) {
                  if (currentCourse.length<14) currentCourse.push("")
                  responseArray.push(currentCourse)
                }
                currentCourse = []


                currentCourse.push(className)
                var index;
                for (index = 0; index < 4; index++) {
                  currentCourse.push(course[index].trim())
                }
                currentCourse.push([])
                var times = []
                if (course.length==20) {
                  for (let timeIndex = 4; timeIndex < 13; timeIndex++) {
                    var trimmed = course[timeIndex].trim()
                    if (trimmed!="") times.push(trimmed)
                  }
                } else {times.push(course[4])
                  times.push(course[5])
                }
                if (course.length==20) times.push(course[17])
                else times.push(course[10])
                currentCourse[5].push(times)
                

                if (course.length==13){
                  for (index = 6; index < 13; index++) {
                    currentCourse.push(course[index])
                  }
                } else {
                  for (index = 13; index < 20; index++) {
                    currentCourse.push(course[index])
                  }
                }

                i++
                if (i>=returnedData.length) break;
                course = returnedData[i]
                while(course.length==8 || course.length==15){
                  var otherTimes = []
                  if (course.length==15){
                    for (let ind = 1; ind < 10; ind++) {
                      var trimmed = course[ind].trim()
                      if (trimmed!="") otherTimes.push(trimmed)
                    }
                    otherTimes.push(course[12])
                  }else{
                    for (let ind = 1; ind < 3; ind++) {
                      var trimmed = course[ind].trim()
                      if (trimmed!="") otherTimes.push(trimmed)
                    }
                    otherTimes.push(course[5])
                  }

                  currentCourse[5].push(otherTimes)
                  i++
                  if (i>=returnedData.length) break;
                  course = returnedData[i]
                  if (course.length==1 && course[0].trim().substring(0,2)!=course[0].trim().substring(0,2).toUpperCase()){
                    currentCourse.push(course[0].trim())
                    continue
                  }
                }
                i--
              }

            }
            if (currentCourse.length>0) {
              if (currentCourse.length<14) currentCourse.push("")
                responseArray.push(currentCourse)
            }




            var output = []
            responseArray.forEach(c => {
              var session = c[5]
              var timesArray = []
              session.forEach(element => {
                var dates = element[element.length-1]
                var room = element[element.length-2]
                var times = element[element.length-3]
                var weekdays = element.slice(0, element.length-3)
                timesArray.push({
                  meetingDays:weekdays,
                  meetingTimes:times,
                  classroom:room,
                  date:dates
                })
              });
              


              output.push({
                name:c[0].trim(),
                status:c[1].trim(),
                crn:c[2].trim(),
                cred:c[3].trim(),
                textbookCost:c[4].trim(),
                meetingTimes:timesArray,
                max:c[6].trim(),
                enrolled:c[7].trim(),
                waitlisted:c[8].trim(),
                instructor:c[9].trim(),
                dates:c[10].trim(),
                weeks:c[11].trim(),
                book:c[12].trim(),
                notes:c[13]
              })
            });
            



            res.json(output)
        }); //end call 2
    }) //end call 1
});//END GET

app.listen(PORT, () => console.log("Running on PORT " + PORT));
