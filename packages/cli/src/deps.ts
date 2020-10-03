import dayjs from 'dayjs'
import yaml from 'js-yaml'

console.log(yaml.safeDump(dayjs().toDate()))
