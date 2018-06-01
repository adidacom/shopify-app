import React, { Component } from 'react';

export default class CheckCharge extends Component {
    constructor(props) {
        super(props);
    }
    componentWillMount() {
        fetch('/app/shopify/shopify/charge', {
            credentials: "same-origin"
        })
        .then(result => result.json())
        .then(data => {
            console.log(data);
        });
    }
    render() {
        return (
            <div>
                <h3>This is demo react component for shopify app!</h3>
            </div>
        )
    }
}