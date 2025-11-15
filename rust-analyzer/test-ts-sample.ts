import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UnusedService } from './unused.service';

@Component({
  selector: 'app-test',
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.css']
})
export class TestComponent implements OnInit {
  data: any;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    const result = this.fetchData();
    this.data = result;
  }

  async fetchData() {
    return await this.http.get('/api/data').toPromise();
  }

  processData() {
    if (this.data) {
      console.log('Processing data');
      const filtered = this.data.filter(item => item.active);
      return filtered;
    }
  }

  filterData() {
    if (this.data) {
      console.log('Filtering data');
      const filtered = this.data.filter(item => item.active);
      return filtered;
    }
  }
}
