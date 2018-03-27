
function activeOne(className) {
    var $menu = $(".j-menu");
    $menu.find('li').removeClass("active");
    $menu.find(className).addClass("active");
}
var routes = [
    {
        path: "/",
        before: function (route, next) {
            $.get('/data/table1.json').then(function (json) {
                console.log(json);
                route.json = json;
                next(route);
            }).fail(function (err) {
                console.log(err);
            })
            return false;
        },
        enter: function (route, next) {
            $('#main').html(nunjucks.render('home.njk', { data: route.json }))
            showChart();
        },
        leave: function (route, next) {
            // return false can prevent leave! util you invoke `next` manually
            setTimeout(function () {
                $(".j-menus .home").removeClass("active");
                console.log('left home!')
                // 如果leave()返回false, 则不调用 next 的话, 就不会离开
                next();
            }, 1000);
            return false;
        }
    },
    {
        path: "/user",
        name: 'user',
        enter: function (route, next) {
            $(".j-app")[0].innerHTML = $("#user-tpl").html();
            $(".j-menus .user").addClass("active");

            console.log('user entered!');
        },
        leave: function (route, next) {
            console.log('user left!');
            $(".j-menus .user").removeClass("active");
            // next();
        }
    },
    {
        path: "/user/list",
        parent: "user",
        enter: function (route, next) {
            console.log('user.list entered!')
            // in real enviroment, you need a template engine to complete the work.
            activeOne(".user-list");
            var list = "<ul>";
            for (var i = 0; i < 4; i++) {
                list += "<li><a href='#!/user/" + i + "'>user " + i + "</a></li>"
            }
            list += "</ul>"
            $(".j-user").html(list);

        },
        leave: function () {
            console.log('user.list left!');
        }
    },
    {
        path: "/user/:id",
        parent: 'user',
        name: 'user.detail',
        before: function (route, next) {
            // if (route.params.id == 3) {
            // 	alert('不允许查询 user' + route.params.id);
            // 	return false;
            // }
            console.log('before user.detail enter!');
            // next(route);
        },
        enter: function (route, next) {
            console.log('user.detail entered!');
            activeOne(".user-detail");
            // update or enter, we need update the user infomation
            $(".j-user").html("<h4><a href='#!/user/list'><< return list</a></h4>\
					<p>User " + route.params.id + "'s detail. <a href='#!/user/" + route.params.id + "/all'>show all</a></p>");
        }
    },
    {
        path: "/user/:id/all",
        parent: 'user.detail',
        enter: function (route, next) {
            // activeOne(".user-detail");
            console.log('user.detail.all entered!');
            // update or enter, we need update the user infomation
            $(".j-user").append("<div class='user-all'>用户: <b>" + route.params.id + "</b>的所有信息</div>");
        },
        leave: function (route) {
            console.log('leaving user: ' + route.params.id + ' \'s all informations ');
            $(".j-user .user-all").remove();
        }
    },
    {
        path: "/user/config",
        parent: 'user',
        enter: function (route, next) {
            activeOne(".user-config");
            $(".j-user").html("<p class='well'>user config page. <p><b>when you leave this page, you should confirm</b>");
        },
        leave: function (route, go) {
            // 
            console.log('I wanna leave user.config');
            if (confirm('确定离开?')) {
                console.log('you can leave now.')
                go(route);
            }
            // remember to return false, if you don't want to leave without confirm.
            return false;
        }
    }
];
routes.forEach(function (route) {
    lxr.on(route);
});
lxr.start();
// var stateman = new StateMan();

// stateman
// 	.state(states)
// 	.state("user.config", function () {
// 		activeOne(".user-config");
// 		$(".j-user").html("<p class='well'>user config page<p>");
// 	})
// 	.on("notfound", function (path) {
// 		stateman.go("home", { replace: true });
// 	})
// 	.on("end", function () {

// 	})
// 	.start({ html5: true, "root": "/layout.html" })

function showChart() {

    var ctx = document.getElementById("myChart");
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            datasets: [{
                data: [15339, 21345, 18483, 24003, 23489, 24092, 12034],
                lineTension: 0,
                backgroundColor: 'transparent',
                borderColor: '#007bff',
                borderWidth: 4,
                pointBackgroundColor: '#007bff'
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: false
                    }
                }]
            },
            legend: {
                display: false,
            }
        }
    });
}