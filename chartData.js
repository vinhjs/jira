var chartColors = {
	red: 'rgb(255, 99, 132)',
	orange: 'rgb(255, 159, 64)',
	yellow: 'rgb(255, 205, 86)',
	green: 'rgb(75, 192, 192)',
	blue: 'rgb(54, 162, 235)',
	purple: 'rgb(153, 102, 255)',
	grey: 'rgb(201, 203, 207)'
};
var barStackChartData = {
    labels: ['nguyen.tran','vi.phantt','hoang.dinh','dat.huynh','dong.nguyen','nghia.huynht','dat.pham','thuan.le','hao.le','nhuan.vu','trinh.nguyent','quynh.hoang','thanh.nguyen','anh.bui','dung.nguyen','tuan.nguyena','hao.lek','an.nguyenp','hien.do','phuong.tran','vinh.tran','chuong.nguyen','duy.nguyen','nhan.phan','vi.leh','thuan.ho','hoang.nguyen','chuong.vo','nhan.nguyentt','hai.ta'],
    datasets: [{
        label: 'Bugs',
        backgroundColor: chartColors.red,
        data: []
    }, {
        label: 'Sub-task',
        backgroundColor: chartColors.blue,
        data: []
    }, {
        label: 'Improvement',
        backgroundColor: chartColors.green,
        data: []
    }, {
        label: 'Task',
        backgroundColor: chartColors.orange,
        data: []
    },{
        label: 'Total issues',
        backgroundColor: chartColors.purple,
        data: []
    }]

};
function buildChartStack(chart, data){
    chart = chart || barStackChartData;
}
