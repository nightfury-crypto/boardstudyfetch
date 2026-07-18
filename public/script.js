const generateBtn = document.getElementById("generateBtn");

const urlInput = document.getElementById("url");

const buttonText = document.getElementById("buttonText");

const loader = document.getElementById("loader");


const progressArea =
    document.getElementById("progressArea");


const progressFill =
    document.getElementById("progressFill");


const statusText =
    document.getElementById("status");


const percentageText =
    document.getElementById("percentage");


const counter =
    document.getElementById("counter");


const success =
    document.getElementById("success");


const errorBox =
    document.getElementById("error");





generateBtn.addEventListener(
    "click",
    async () => {


        const url = urlInput.value.trim();



        if (!url) {

            showError(
                "Please enter a webpage URL"
            );

            return;

        }



        resetUI();



        generateBtn.disabled = true;


        buttonText.innerText =
            "Generating...";


        loader.classList.remove(
            "hidden"
        );



        progressArea.classList.remove(
            "hidden"
        );



        try {


            /*
            Start generation
            */


            const response =
                await fetch(
                    "/api/generate",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                url
                            })

                    }
                );



            const data =
                await response.json();



            const jobId =
                data.jobId;




            /*
            Connect to live progress
            */


            const events =
                new EventSource(
                    `/api/progress/${jobId}`
                );




            events.onmessage =
                async (event) => {


                    const job =
                        JSON.parse(
                            event.data
                        );



                    if (job.error) {

                        events.close();

                        showError(
                            job.error
                        );

                        finish();

                        return;

                    }





                    updateProgress(job);





                    if (job.completed) {


                        events.close();


                        success.classList.remove(
                            "hidden"
                        );


                        statusText.innerText =
                            "Downloading PDF...";



                        downloadPDF(jobId);



                        finish();


                    }


                };



            events.onerror = () => {

                events.close();

                showError(
                    "Connection lost"
                );

                finish();

            };



        }

        catch (err) {

            showError(
                err.message
            );

            finish();

        }


    });









function updateProgress(job) {


    statusText.innerText =
        job.status;



    percentageText.innerText =
        `${job.percentage || 0}%`;



    counter.innerText =
        `${job.current || 0} / ${job.total || 0}`;



    progressFill.style.width =
        `${job.percentage || 0}%`;

}





function downloadPDF(jobId) {


    const link =
        document.createElement(
            "a"
        );


    link.href =
        `/api/download/${jobId}`;


    link.download =
        "notes.pdf";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();

}





function resetUI() {


    success.classList.add(
        "hidden"
    );


    errorBox.classList.add(
        "hidden"
    );


    progressFill.style.width =
        "0%";


    statusText.innerText =
        "Starting...";


    percentageText.innerText =
        "0%";


    counter.innerText =
        "0 / 0";

}





function showError(message) {


    errorBox.innerText =
        "❌ " + message;


    errorBox.classList.remove(
        "hidden"
    );

}





function finish() {


    generateBtn.disabled = false;


    loader.classList.add(
        "hidden"
    );


    buttonText.innerText =
        "Generate PDF";

}